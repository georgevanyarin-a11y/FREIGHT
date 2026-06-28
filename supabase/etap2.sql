-- ============================================================================
--  ЭТАП 2: Пайплайн заявки, привязка к заказчику, чек-лист
--  Выполнить в Supabase → SQL Editor → Run
-- ============================================================================

-- Этап (статус) в воронке: new/signed/in_transit/delivered/ttn_sent/billed/originals_sent/paid/cancelled
alter table public.orders add column if not exists stage text default 'new';

-- Привязка к карточке заказчика
alter table public.orders add column if not exists counterparty_id uuid
  references public.counterparties(id) on delete set null;

-- Чек-лист этапов: [{ key, label, done }]
alter table public.orders add column if not exists checklist jsonb default '[]'::jsonb;

-- Когда последний раз меняли этап (для напоминаний на будущих этапах)
alter table public.orders add column if not exists stage_changed_at timestamptz;

-- Перенесём старые заявки: если был status='done' — считаем оплаченными/завершёнными
update public.orders set stage = 'paid' where stage is null and status = 'done';
update public.orders set stage = 'new'  where stage is null;
