-- ============================================================================
--  Перевозчик CRM — схема таблицы "orders" с Row Level Security
--  Выполните этот скрипт в Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- 1. Таблица заявок
create table if not exists public.orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,

  order_number              text,
  order_date                date,

  loading_address           text,
  unloading_address         text,

  loading_contact_name      text,
  loading_contact_phone     text,
  unloading_contact_name    text,
  unloading_contact_phone   text,

  delivery_deadline         date,
  rate                      numeric(12, 2),
  status                    text not null default 'active'
                              check (status in ('active', 'done')),
  note                      text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Индекс для быстрой выборки заявок пользователя в порядке создания
create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

-- 2. Автообновление updated_at при UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- 3. Включаем Row Level Security
alter table public.orders enable row level security;

-- 4. Политики: каждый пользователь работает только со своими заявками
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "orders_update_own" on public.orders;
create policy "orders_update_own"
  on public.orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "orders_delete_own" on public.orders;
create policy "orders_delete_own"
  on public.orders for delete
  using (auth.uid() = user_id);
