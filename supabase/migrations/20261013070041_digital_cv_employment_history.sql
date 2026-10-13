-- TrataPro Digital CV and verified employment history.
-- The application keeps its existing server-side session system. Browser roles
-- receive no table grants; only the trusted server service role can reach these
-- records, and the Node API applies worker/company row authorization.

create table if not exists public.meo_cv_profiles (
  id text primary key,
  worker_id text not null unique references public.meo_users(id) on delete restrict,
  current_version_id text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  headline text not null default '',
  summary text not null default '',
  personal_details jsonb not null default '{}'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  qualifications jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  work_history jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  licences jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.meo_cv_versions (
  id text primary key,
  cv_profile_id text not null references public.meo_cv_profiles(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_source text not null check (change_source in ('manual','document_confirmed','migration')),
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cv_profile_id, version)
);

alter table public.meo_cv_profiles drop constraint if exists meo_cv_profiles_current_version_fk;
alter table public.meo_cv_profiles add constraint meo_cv_profiles_current_version_fk
  foreign key (current_version_id) references public.meo_cv_versions(id) on delete set null
  deferrable initially deferred;

create table if not exists public.meo_cv_documents (
  id text primary key,
  cv_profile_id text not null references public.meo_cv_profiles(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete restrict,
  version_id text references public.meo_cv_versions(id) on delete set null,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  stored_name text not null unique,
  byte_size bigint not null check (byte_size > 0),
  file_hash text not null,
  extraction_status text not null check (extraction_status in ('extracted','manual_review','failed')),
  extracted_data jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.meo_company_verifications (
  id text primary key,
  company_id text not null unique references public.meo_companies(id) on delete cascade,
  status text not null check (status in ('pending','verified','rejected','suspended')),
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  verified_by text references public.meo_users(id) on delete set null,
  verified_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meo_company_memberships (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  user_id text not null references public.meo_users(id) on delete cascade,
  role text not null check (role in ('company','manager')),
  status text not null check (status in ('active','suspended','revoked')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.meo_employment_relationships (
  id text primary key,
  worker_id text not null references public.meo_users(id) on delete restrict,
  company_id text references public.meo_companies(id) on delete restrict,
  company_name text not null,
  position text not null,
  start_date date not null,
  end_date date,
  employment_status text not null check (employment_status in ('active','ended','archived')),
  verification_status text not null check (verification_status in ('self_declared','pending','verified','rejected','disputed')),
  worker_confirmed_at timestamptz,
  company_confirmed_at timestamptz,
  created_by text not null references public.meo_users(id) on delete restrict,
  created_by_role text not null check (created_by_role in ('worker','company')),
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.meo_employer_evaluation_reports (
  id text primary key,
  employment_id text not null references public.meo_employment_relationships(id) on delete restrict,
  worker_id text not null references public.meo_users(id) on delete restrict,
  company_id text not null references public.meo_companies(id) on delete restrict,
  author_id text not null references public.meo_users(id) on delete restrict,
  status text not null check (status in ('draft','submitted','corrected','superseded','withdrawn','expired')),
  assessment_context text not null default '',
  factual_experience jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  supersedes_report_id text references public.meo_employer_evaluation_reports(id) on delete restrict,
  submitted_at timestamptz,
  review_expires_at timestamptz not null,
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meo_evaluation_criteria (
  id text primary key,
  report_id text not null references public.meo_employer_evaluation_reports(id) on delete cascade,
  criterion text not null check (criterion in ('reliability','quality','teamwork','adaptability','safety')),
  rating integer not null check (rating between 1 and 5),
  context text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, criterion)
);

create table if not exists public.meo_company_access_grants (
  id text primary key,
  worker_id text not null references public.meo_users(id) on delete restrict,
  requester_company_id text not null references public.meo_companies(id) on delete restrict,
  requested_by text not null references public.meo_users(id) on delete restrict,
  purpose text not null,
  lawful_basis text not null check (lawful_basis in ('legitimate_interest','legal_obligation','pre_contract_steps')),
  status text not null check (status in ('pending_dpia','rejected','expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decision_by text references public.meo_users(id) on delete set null
);

create table if not exists public.meo_worker_disputes (
  id text primary key,
  worker_id text not null references public.meo_users(id) on delete restrict,
  employment_id text references public.meo_employment_relationships(id) on delete restrict,
  report_id text references public.meo_employer_evaluation_reports(id) on delete restrict,
  company_id text references public.meo_companies(id) on delete restrict,
  type text not null check (type in ('correction','context','dispute','restriction','deletion','access')),
  description text not null,
  worker_response text not null default '',
  status text not null check (status in ('open','under_review','resolved','rejected')),
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.meo_report_access_logs (
  id text primary key,
  worker_id text not null references public.meo_users(id) on delete restrict,
  report_id text references public.meo_employer_evaluation_reports(id) on delete set null,
  employment_id text references public.meo_employment_relationships(id) on delete set null,
  viewer_user_id text references public.meo_users(id) on delete set null,
  viewer_company_id text references public.meo_companies(id) on delete set null,
  action text not null,
  purpose text not null,
  lawful_basis text not null,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.meo_data_retention_actions (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  worker_id text references public.meo_users(id) on delete set null,
  action text not null check (action in ('scheduled','reviewed','restricted','redacted','deleted')),
  reason text not null,
  execute_after timestamptz not null,
  executed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists meo_cv_versions_worker_idx on public.meo_cv_versions(worker_id, version desc);
create index if not exists meo_cv_documents_worker_idx on public.meo_cv_documents(worker_id, created_at desc) where deleted_at is null;
create index if not exists meo_employment_worker_idx on public.meo_employment_relationships(worker_id, start_date desc);
create index if not exists meo_employment_company_idx on public.meo_employment_relationships(company_id, start_date desc);
create index if not exists meo_evaluation_worker_idx on public.meo_employer_evaluation_reports(worker_id, submitted_at desc);
create index if not exists meo_evaluation_company_idx on public.meo_employer_evaluation_reports(company_id, submitted_at desc);
create index if not exists meo_disputes_worker_idx on public.meo_worker_disputes(worker_id, created_at desc);
create index if not exists meo_access_worker_idx on public.meo_company_access_grants(worker_id, requested_at desc);
create index if not exists meo_report_access_worker_idx on public.meo_report_access_logs(worker_id, created_at desc);
create index if not exists meo_retention_due_idx on public.meo_data_retention_actions(execute_after) where executed_at is null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'meo_cv_profiles','meo_cv_versions','meo_cv_documents','meo_company_verifications',
    'meo_company_memberships','meo_employment_relationships','meo_employer_evaluation_reports',
    'meo_evaluation_criteria','meo_company_access_grants','meo_worker_disputes',
    'meo_report_access_logs','meo_data_retention_actions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('drop policy if exists %I on public.%I', 'meo service ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', 'meo service ' || table_name, table_name);
  end loop;
end $$;

update storage.buckets
set public = false,
    file_size_limit = greatest(coalesce(file_size_limit, 0), 8388608),
    allowed_mime_types = array[
      'image/png','image/jpeg','image/webp','application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'meo-evidence';

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
    if not (table_name = any(array[
      'meo_companies','meo_users','meo_sessions','meo_invites','meo_work_orders','meo_tasks',
      'meo_evidences','meo_audit_logs','meo_job_offers','meo_job_applications',
      'meo_recruitment_messages','meo_job_reports','meo_cv_profiles','meo_cv_versions',
      'meo_cv_documents','meo_company_verifications','meo_company_memberships',
      'meo_employment_relationships','meo_employer_evaluation_reports','meo_evaluation_criteria',
      'meo_company_access_grants','meo_worker_disputes','meo_report_access_logs',
      'meo_data_retention_actions'
    ])) then
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
