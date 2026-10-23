-- Link each published workday to an existing task without changing legacy schedules.
alter table public.meo_work_schedules
  add column if not exists task_id text references public.meo_tasks(id) on delete set null;

create index if not exists meo_work_schedules_task_id
  on public.meo_work_schedules(task_id);
