-- Cliente Zero, fase 1: ordens como unidade operacional principal.
-- Aditiva e compatível com ordens anteriores: nenhum registo é removido.
alter table public.meo_work_orders
  add column if not exists assigned_user_ids jsonb not null default '[]'::jsonb,
  add column if not exists expected_start_date date,
  add column if not exists expected_end_date date,
  add column if not exists status text not null default 'planned',
  add column if not exists status_reason text not null default '',
  add column if not exists actual_started_at timestamptz,
  add column if not exists actual_completed_at timestamptz;

-- Preserve existing task assignments when upgrading older work orders.
update public.meo_work_orders as work_order
set assigned_user_ids = to_jsonb(array(
  select distinct task.assignee_id
  from public.meo_tasks as task
  where task.work_order_id = work_order.id
  order by task.assignee_id
  limit 20
))
where work_order.assigned_user_ids = '[]'::jsonb
  and exists (select 1 from public.meo_tasks as task where task.work_order_id = work_order.id);

alter table public.meo_work_orders
  drop constraint if exists meo_work_orders_status_check;
alter table public.meo_work_orders
  add constraint meo_work_orders_status_check check (
    status in ('planned', 'in_progress', 'blocked', 'pending_validation', 'approved', 'rejected')
  );

alter table public.meo_work_orders
  drop constraint if exists meo_work_orders_expected_dates_check;
alter table public.meo_work_orders
  add constraint meo_work_orders_expected_dates_check check (
    expected_end_date is null or expected_start_date is null or expected_end_date >= expected_start_date
  );

alter table public.meo_work_orders
  drop constraint if exists meo_work_orders_assigned_users_check;
alter table public.meo_work_orders
  add constraint meo_work_orders_assigned_users_check check (
    jsonb_typeof(assigned_user_ids) = 'array' and jsonb_array_length(assigned_user_ids) <= 20
  );

create index if not exists meo_work_orders_company_status_idx
  on public.meo_work_orders(company_id, status);

comment on column public.meo_work_orders.assigned_user_ids is
  'IDs internos da equipa atribuída; API valida empresa ou vínculo verificado.';

-- A tabela existente mantém RLS; a app usa apenas a chave service_role no servidor.
alter table public.meo_work_orders enable row level security;
revoke all on public.meo_work_orders from anon, authenticated;
grant select, insert, update on public.meo_work_orders to service_role;
