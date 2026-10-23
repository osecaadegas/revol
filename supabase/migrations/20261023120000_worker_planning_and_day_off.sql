-- Company-only planning, worker-visible through the application server.
create table if not exists public.meo_work_schedules (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete restrict,
  worker_id text not null references public.meo_users(id) on delete restrict,
  employment_id text not null references public.meo_employment_relationships(id) on delete restrict,
  work_date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  address text not null check (char_length(address) > 0),
  note text not null default '',
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (company_id, worker_id, work_date)
);
create index if not exists meo_work_schedules_company_date on public.meo_work_schedules(company_id, work_date);
create index if not exists meo_work_schedules_worker_date on public.meo_work_schedules(worker_id, work_date);

create table if not exists public.meo_day_off_requests (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete restrict,
  worker_id text not null references public.meo_users(id) on delete restrict,
  employment_id text not null references public.meo_employment_relationships(id) on delete restrict,
  work_date date not null,
  reason text not null default '',
  status text not null check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null,
  decided_at timestamptz,
  decided_by text references public.meo_users(id) on delete restrict,
  decision_note text not null default ''
);
create unique index if not exists meo_day_off_one_active_request on public.meo_day_off_requests(company_id, worker_id, work_date)
  where status in ('pending', 'approved');
create index if not exists meo_day_off_company_date on public.meo_day_off_requests(company_id, work_date);

alter table public.meo_work_schedules enable row level security;
alter table public.meo_day_off_requests enable row level security;
revoke all on public.meo_work_schedules, public.meo_day_off_requests from public, anon, authenticated;
grant select, insert, update, delete on public.meo_work_schedules, public.meo_day_off_requests to service_role;
create policy "meo service work schedules" on public.meo_work_schedules for all to service_role using (true) with check (true);
create policy "meo service day off requests" on public.meo_day_off_requests for all to service_role using (true) with check (true);

-- Preserve the optimistic, single-transaction persistence path and extend only its allowlist.
create or replace function public.meo_apply_changes(changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  change jsonb; table_name text; key_column text; current_row jsonb; expected_row jsonb;
  columns_sql text; values_sql text; updates_sql text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meo_apply_changes',0));
  for change in select value from pg_catalog.jsonb_array_elements(changes) loop
    table_name := change->>'table';
    if not (table_name = any(array[
      'meo_companies','meo_users','meo_sessions','meo_invites','meo_work_orders','meo_tasks','meo_evidences',
      'meo_attendance_entries','meo_attendance_justifications','meo_work_schedules','meo_day_off_requests','meo_audit_logs','meo_job_offers','meo_job_applications',
      'meo_recruitment_messages','meo_direct_conversations','meo_direct_messages','meo_job_reports','meo_cv_profiles',
      'meo_cv_versions','meo_cv_documents','meo_company_verifications','meo_company_memberships','meo_employment_relationships',
      'meo_employer_evaluation_reports','meo_evaluation_criteria','meo_custom_evaluation_questions','meo_evaluation_question_versions',
      'meo_evaluation_answers','meo_evaluation_revisions','meo_company_access_grants','meo_worker_disputes','meo_report_access_logs',
      'meo_data_retention_actions'
    ])) then raise exception 'Invalid table'; end if;
    key_column := case when table_name = 'meo_sessions' then 'token_hash' else 'id' end;
    execute format('select to_jsonb(t) from public.%I t where %I = $1',table_name,key_column) into current_row using change->>'id';
    if change->'before' is distinct from 'null'::jsonb then
      execute format('select to_jsonb(r) from jsonb_populate_record(null::public.%I,$1) r',table_name) into expected_row using change->'before';
      if current_row is distinct from expected_row then raise exception using errcode='40001',message='Concurrent update'; end if;
    elsif current_row is not null then raise exception using errcode='40001',message='Concurrent insert'; end if;
    if change->'after' = 'null'::jsonb then
      execute format('delete from public.%I where %I = $1',table_name,key_column) using change->>'id';
    else
      select string_agg(format('%I',key),', '),string_agg(format('r.%I',key),', '),string_agg(format('%I = excluded.%I',key,key),', ')
        into columns_sql,values_sql,updates_sql from pg_catalog.jsonb_object_keys(change->'after') key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r on conflict (%I) do update set %s',table_name,columns_sql,values_sql,table_name,key_column,updates_sql) using change->'after';
    end if;
  end loop;
end;
$$;
revoke all on function public.meo_apply_changes(jsonb) from public, anon, authenticated;
grant execute on function public.meo_apply_changes(jsonb) to service_role;
