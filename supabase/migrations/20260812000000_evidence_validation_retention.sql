-- Adds final-evidence validation metadata, 12-hour employer validation windows,
-- and 7-day evidence retention fields.

alter table if exists public.meo_tasks
  add column if not exists validation_due_at timestamptz;

alter table if exists public.meo_evidences
  add column if not exists captured_at timestamptz,
  add column if not exists uploaded_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists file_hash text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists authenticity jsonb not null default '{}'::jsonb;

update public.meo_evidences
set
  captured_at = coalesce(captured_at, created_at),
  uploaded_at = coalesce(uploaded_at, created_at),
  expires_at = coalesce(expires_at, created_at + interval '7 days')
where captured_at is null
   or uploaded_at is null
   or expires_at is null;

alter table if exists public.meo_evidences
  alter column captured_at set not null,
  alter column uploaded_at set not null,
  alter column expires_at set not null;

create index if not exists meo_evidences_expires_idx on public.meo_evidences(expires_at);
create index if not exists meo_tasks_validation_due_idx on public.meo_tasks(validation_due_at);
