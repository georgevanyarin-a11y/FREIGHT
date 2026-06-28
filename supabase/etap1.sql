-- ============================================================================
--  ЭТАП 1: Профиль перевозчика, документы перевозчика, контрагенты
--  Выполнить в Supabase → SQL Editor → New query → Run
-- ============================================================================

-- ---------- 1. Профиль перевозчика (одна строка на пользователя) ----------
create table if not exists public.carrier_profile (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  -- Данные ИП
  full_name         text,
  inn               text,
  ogrnip            text,
  -- Банковские реквизиты
  bank_name         text,
  bank_account      text,
  bank_bik          text,
  bank_corr_account text,
  -- Контакты
  phone             text,
  email             text,
  address           text,
  -- Транспорт
  vehicle_make      text,     -- марка (например, КамАЗ 5490)
  vehicle_plate     text,     -- госномер тягача
  trailer_plate     text,     -- госномер прицепа
  body_type         text,     -- тип кузова (тент, рефрижератор, бортовой...)
  capacity_t        numeric,  -- грузоподъёмность, т
  volume_m3         numeric,  -- объём, м3
  updated_at        timestamptz default now()
);

alter table public.carrier_profile enable row level security;

drop policy if exists "carrier_profile_own" on public.carrier_profile;
create policy "carrier_profile_own" on public.carrier_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 2. Документы перевозчика (паспорт, СТС, ВУ, страховка...) ----------
create table if not exists public.carrier_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_type    text,            -- passport/inn/ogrnip/sts/license/osago/contract/partner_card/other
  title       text,
  file_path   text,            -- путь в Storage (bucket "documents")
  file_name   text,
  expires_on  date,            -- срок действия (для будущих напоминаний)
  created_at  timestamptz default now()
);

alter table public.carrier_documents enable row level security;

drop policy if exists "carrier_documents_own" on public.carrier_documents;
create policy "carrier_documents_own" on public.carrier_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 3. Контрагенты (заказчики) ----------
create table if not exists public.counterparties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  inn           text,
  kpp           text,
  ogrn          text,
  address       text,
  contact_name  text,
  phone         text,
  email         text,
  bank_name     text,
  bank_account  text,
  bank_bik      text,
  reliability   text default 'unknown',  -- unknown/good/watch/bad
  note          text,
  created_at    timestamptz default now()
);

alter table public.counterparties enable row level security;

drop policy if exists "counterparties_own" on public.counterparties;
create policy "counterparties_own" on public.counterparties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 4. Storage для документов ----------
-- Если модуль «Документы» уже настроен — bucket и политики есть, этот блок можно НЕ запускать.
-- Документы перевозчика складываются в тот же bucket "documents", в папку {user_id}/carrier/...
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Политики Storage (создаются, только если их ещё нет)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_own_select') then
    create policy "documents_own_select" on storage.objects for select
      using (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_own_insert') then
    create policy "documents_own_insert" on storage.objects for insert
      with check (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='documents_own_delete') then
    create policy "documents_own_delete" on storage.objects for delete
      using (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
