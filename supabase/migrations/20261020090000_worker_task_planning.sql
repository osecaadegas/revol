alter table public.meo_tasks
  add column if not exists employment_id text references public.meo_employment_relationships(id) on delete restrict,
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists planning_notes text not null default '',
  add column if not exists work_address text not null default '',
  add column if not exists work_location jsonb not null default '{"status":"not_requested"}'::jsonb;

create index if not exists meo_tasks_employment_idx
  on public.meo_tasks(employment_id)
  where employment_id is not null;

create index if not exists meo_tasks_scheduled_start_idx
  on public.meo_tasks(company_id, scheduled_start_at)
  where scheduled_start_at is not null;

comment on column public.meo_tasks.employment_id is
  'Verified employment relationship authorising a recruitment worker assignment.';
comment on column public.meo_tasks.work_location is
  'Fixed task work location supplied during planning; never continuous worker tracking.';
