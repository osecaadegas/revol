-- Additive recruitment fields; existing operational tables and roles are preserved.
alter table public.meo_companies add column if not exists recruitment jsonb not null default '{}'::jsonb;
alter table public.meo_job_offers add column if not exists recruitment jsonb not null default '{}'::jsonb;
alter table public.meo_job_applications add column if not exists recruitment jsonb not null default '{}'::jsonb;
alter table public.meo_job_applications drop constraint if exists meo_job_applications_status_check;
alter table public.meo_job_applications add constraint meo_job_applications_status_check
  check (status in ('submitted','viewed','reviewed','contacted','interview','offer','accepted','hired','rejected'));

create table if not exists public.meo_recruitment_messages (
  id text primary key,
  company_id text not null references public.meo_companies(id),
  worker_id text not null references public.meo_users(id),
  job_offer_id text not null references public.meo_job_offers(id),
  sender_id text not null references public.meo_users(id),
  body text not null,
  interview_at timestamptz,
  response text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.meo_job_reports (
  id text primary key,
  job_offer_id text not null references public.meo_job_offers(id),
  user_id text not null references public.meo_users(id),
  reason text not null,
  detail text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.meo_recruitment_messages enable row level security;
alter table public.meo_job_reports enable row level security;
revoke all on public.meo_recruitment_messages, public.meo_job_reports from anon, authenticated;
grant all on public.meo_recruitment_messages, public.meo_job_reports to service_role;
create policy "meo service messages" on public.meo_recruitment_messages for all to service_role using (true) with check (true);
create policy "meo service reports" on public.meo_job_reports for all to service_role using (true) with check (true);
create index if not exists meo_messages_worker_idx on public.meo_recruitment_messages(worker_id, created_at);
create index if not exists meo_messages_company_idx on public.meo_recruitment_messages(company_id, created_at);
create index if not exists meo_reports_status_idx on public.meo_job_reports(status, created_at);
update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','application/pdf']
where id = 'meo-evidence' and public = false;

-- Apply only changed rows in one transaction. Reject stale edits from another
-- serverless instance instead of overwriting a newer record.
create or replace function public.meo_apply_changes(changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  change jsonb;
  table_name text;
  key_column text;
  current_row jsonb;
  expected_row jsonb;
  columns_sql text;
  values_sql text;
  updates_sql text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meo_apply_changes', 0));
  for change in select value from pg_catalog.jsonb_array_elements(changes) loop
    table_name := change->>'table';
    if not (table_name = any(array['meo_companies','meo_users','meo_sessions','meo_invites','meo_work_orders','meo_tasks','meo_evidences','meo_audit_logs','meo_job_offers','meo_job_applications','meo_recruitment_messages','meo_job_reports'])) then
      raise exception 'Invalid table';
    end if;
    key_column := case when table_name = 'meo_sessions' then 'token_hash' else 'id' end;
    execute format('select to_jsonb(t) from public.%I t where %I = $1', table_name, key_column)
      into current_row using change->>'id';
    if change->'before' is distinct from 'null'::jsonb then
      execute format('select to_jsonb(r) from jsonb_populate_record(null::public.%I, $1) r', table_name)
        into expected_row using change->'before';
      if current_row is distinct from expected_row then raise exception using errcode='40001', message='Concurrent update'; end if;
    elsif current_row is not null then
      raise exception using errcode='40001', message='Concurrent insert';
    end if;
    if change->'after' = 'null'::jsonb then
      execute format('delete from public.%I where %I = $1', table_name, key_column) using change->>'id';
    else
      select string_agg(format('%I', key), ', '), string_agg(format('r.%I', key), ', '),
             string_agg(format('%I = excluded.%I', key, key), ', ')
        into columns_sql, values_sql, updates_sql from pg_catalog.jsonb_object_keys(change->'after') key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r on conflict (%I) do update set %s',
        table_name, columns_sql, values_sql, table_name, key_column, updates_sql) using change->'after';
    end if;
  end loop;
end;
$$;
revoke all on function public.meo_apply_changes(jsonb) from public, anon, authenticated;
grant execute on function public.meo_apply_changes(jsonb) to service_role;
