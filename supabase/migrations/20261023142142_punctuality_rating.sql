-- Additive, private punctuality evidence. Existing attendance stays unscored;
-- no legacy clock-in is inferred to be verified against a mutable schedule.
alter table public.meo_companies
  add column if not exists punctuality_config jsonb not null default
    '{"version":1,"windowDays":90,"graceSeconds":300,"minorLimitSeconds":900,"significantLimitSeconds":1800,"confirmedShifts":20,"scores":[10,8,5,0]}'::jsonb;

alter table public.meo_work_schedules
  add column if not exists first_published_start_at timestamptz;

alter table public.meo_attendance_entries
  add column if not exists punctuality jsonb;

alter table public.meo_attendance_justifications
  add column if not exists kind text not null default 'absence',
  add column if not exists status text not null default 'pending',
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by text references public.meo_users(id) on delete restrict,
  add column if not exists decision_reason text not null default '';

alter table public.meo_attendance_justifications
  add constraint meo_attendance_justification_kind_check
    check (kind in ('absence','late_arrival','forgotten_clock_in','technical_failure','discrepancy'));
alter table public.meo_attendance_justifications
  add constraint meo_attendance_justification_status_check
    check (status in ('pending','approved','rejected'));

create index if not exists meo_attendance_justification_pending_company
  on public.meo_attendance_justifications(company_id, absence_date desc)
  where status = 'pending';
