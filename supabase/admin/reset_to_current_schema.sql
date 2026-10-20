-- Destructive Supabase reset for the current LuisTrata / MEO schema.
--
-- Use this only when the Supabase project contains old prototype tables and
-- should be reset to the current app model. This deletes the listed public
-- tables and their data, then recreates the current `meo_*` schema.

begin;

drop table if exists
  public.validations,
  public.task_blocks,
  public.task_assignments,
  public.work_order_photos,
  public.evidences,
  public.tasks,
  public.work_orders,
  public.invitations,
  public.company_members,
  public.profiles,
  public.companies,
  public.audit_logs
cascade;

drop table if exists
  public.meo_data_retention_actions,
  public.meo_report_access_logs,
  public.meo_worker_disputes,
  public.meo_company_access_grants,
  public.meo_evaluation_revisions,
  public.meo_evaluation_answers,
  public.meo_evaluation_question_versions,
  public.meo_custom_evaluation_questions,
  public.meo_evaluation_criteria,
  public.meo_employer_evaluation_reports,
  public.meo_employment_relationships,
  public.meo_company_memberships,
  public.meo_company_verifications,
  public.meo_cv_documents,
  public.meo_cv_versions,
  public.meo_cv_profiles,
  public.meo_job_reports,
  public.meo_direct_messages,
  public.meo_direct_conversations,
  public.meo_recruitment_messages,
  public.meo_job_applications,
  public.meo_job_offers,
  public.meo_audit_logs,
  public.meo_evidences,
  public.meo_tasks,
  public.meo_work_orders,
  public.meo_invites,
  public.meo_sessions,
  public.meo_users,
  public.meo_companies,
  public.meo_app_meta
cascade;

drop policy if exists "meo service role storage access" on storage.objects;
drop function if exists public.meo_enforce_global_nif_uniqueness();
drop function if exists public.meo_is_valid_nif(text);

create table public.meo_app_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.meo_app_meta (key, value)
values (
  'state_meta',
  '{
    "version": 1,
    "createdAt": null,
    "nextIds": {
      "companies": 1,
      "users": 1,
      "invites": 1,
      "workOrders": 1,
      "tasks": 1,
      "evidences": 1,
      "auditLogs": 1,
      "jobOffers": 1,
      "jobApplications": 1
    }
  }'::jsonb
);

create function public.meo_is_valid_nif(input text)
returns boolean
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
  select case
    when input ~ '^[1235689][0-9]{8}$' then (
      select (case when candidate >= 10 then 0 else candidate end) = substring(input from 9 for 1)::integer
      from (
        select 11 - (sum(substring(input from position for 1)::integer * (10 - position)) % 11) as candidate
        from generate_series(1, 8) as position
      ) as checksum
    )
    else false
  end;
$$;

revoke all on function public.meo_is_valid_nif(text) from public, anon, authenticated;
grant execute on function public.meo_is_valid_nif(text) to service_role;

create table public.meo_companies (
  id text primary key,
  name text not null,
  nif text check (nif is null or public.meo_is_valid_nif(nif)),
  location text,
  website text,
  sector text,
  description text,
  recruitment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table public.meo_users (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  name text not null,
  email text not null unique,
  nif text check (nif is null or public.meo_is_valid_nif(nif)),
  role text not null check (role in ('manager', 'employee', 'contractor', 'worker', 'company', 'client', 'developer')),
  password_hash text not null,
  active boolean not null default true,
  profile jsonb not null default '{}'::jsonb,
  created_by text references public.meo_users(id) on delete set null,
  invited_by text references public.meo_users(id) on delete set null,
  created_at timestamptz not null
);

create table public.meo_sessions (
  token_hash text primary key,
  user_id text not null references public.meo_users(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create table public.meo_invites (
  id text primary key,
  token_hash text not null unique,
  company_id text not null references public.meo_companies(id) on delete cascade,
  role text not null check (role in ('manager', 'employee', 'contractor', 'worker', 'company', 'client', 'developer')),
  email text,
  name text,
  created_by text not null references public.meo_users(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.meo_work_orders (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  title text not null,
  address text not null,
  description text,
  assigned_user_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(assigned_user_ids) = 'array' and jsonb_array_length(assigned_user_ids) <= 20),
  expected_start_date date,
  expected_end_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','blocked','pending_validation','approved','rejected')),
  status_reason text not null default '',
  actual_started_at timestamptz,
  actual_completed_at timestamptz,
  constraint meo_work_orders_expected_dates_check check (expected_end_date is null or expected_start_date is null or expected_end_date >= expected_start_date),
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.meo_tasks (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  work_order_id text not null references public.meo_work_orders(id) on delete cascade,
  title text not null,
  description text,
  assignee_id text not null references public.meo_users(id) on delete restrict,
  assignee_name text not null,
  employment_id text,
  scheduled_start_at timestamptz,
  planning_notes text not null default '',
  work_address text not null default '',
  work_location jsonb not null default '{"status":"not_requested"}'::jsonb,
  due_date text not null,
  status text not null check (
    status in (
      'planned',
      'assigned',
      'in_progress',
      'blocked',
      'pending_validation',
      'approved',
      'rejected'
    )
  ),
  block_reason text,
  validation_comment text,
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  validation_due_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
);

create table public.meo_evidences (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  task_id text references public.meo_tasks(id) on delete cascade,
  work_order_id text references public.meo_work_orders(id) on delete cascade,
  user_id text not null references public.meo_users(id) on delete restrict,
  user_name text not null,
  kind text not null check (kind in ('initial_photo', 'task_evidence')),
  original_name text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  stored_name text not null,
  note text,
  location jsonb not null default '{"status": "not_requested"}'::jsonb,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null,
  expires_at timestamptz not null,
  file_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  authenticity jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  constraint meo_evidences_has_parent check (task_id is not null or work_order_id is not null)
);

create table public.meo_audit_logs (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  actor_id text references public.meo_users(id) on delete set null,
  actor_name text,
  actor_role text,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null
);

create table public.meo_job_offers (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  company_name text not null,
  title text not null,
  position text,
  location text not null,
  contract_type text,
  salary text,
  schedule text,
  description text not null,
  requirements text,
  status text not null check (status in ('open', 'closed')),
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz
  ,recruitment jsonb not null default '{}'::jsonb
);

create table public.meo_job_applications (
  id text primary key,
  job_offer_id text not null references public.meo_job_offers(id) on delete cascade,
  company_id text not null references public.meo_companies(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete cascade,
  worker_name text not null,
  worker_email text not null,
  message text,
  status text not null check (status in ('submitted','viewed','reviewed','contacted','interview','offer','accepted','hired','rejected')),
  decision_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  recruitment jsonb not null default '{}'::jsonb,
  unique (job_offer_id, worker_id)
);

create table public.meo_recruitment_messages (
  id text primary key, company_id text not null references public.meo_companies(id),
  worker_id text not null references public.meo_users(id), job_offer_id text not null references public.meo_job_offers(id),
  sender_id text not null references public.meo_users(id), body text not null, interview_at timestamptz,
  response text, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.meo_direct_conversations (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete cascade,
  company_user_id text not null references public.meo_users(id) on delete cascade,
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id,worker_id,company_user_id),
  check (worker_id <> company_user_id)
);
create table public.meo_direct_messages (
  id text primary key,
  conversation_id text not null references public.meo_direct_conversations(id) on delete cascade,
  sender_id text not null references public.meo_users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  read_at timestamptz, created_at timestamptz not null default now()
);
create table public.meo_job_reports (
  id text primary key, job_offer_id text not null references public.meo_job_offers(id),
  user_id text not null references public.meo_users(id), reason text not null, detail text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

create table public.meo_cv_profiles (
  id text primary key, worker_id text not null unique references public.meo_users(id) on delete restrict,
  current_version_id text, status text not null default 'draft' check (status in ('draft','published','archived')),
  headline text not null default '', summary text not null default '', personal_details jsonb not null default '{}'::jsonb,
  skills jsonb not null default '[]'::jsonb, qualifications jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb, education jsonb not null default '[]'::jsonb,
  work_history jsonb not null default '[]'::jsonb, languages jsonb not null default '[]'::jsonb,
  licences jsonb not null default '[]'::jsonb, preferences jsonb not null default '{}'::jsonb,
  availability jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), published_at timestamptz
);
create table public.meo_cv_versions (
  id text primary key, cv_profile_id text not null references public.meo_cv_profiles(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete restrict, version integer not null check (version > 0),
  snapshot jsonb not null, change_source text not null check (change_source in ('manual','document_confirmed','migration')),
  created_by text not null references public.meo_users(id) on delete restrict, created_at timestamptz not null default now(),
  unique (cv_profile_id, version)
);
alter table public.meo_cv_profiles add constraint meo_cv_profiles_current_version_fk foreign key (current_version_id) references public.meo_cv_versions(id) on delete set null deferrable initially deferred;
create table public.meo_cv_documents (
  id text primary key, cv_profile_id text not null references public.meo_cv_profiles(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete restrict, version_id text references public.meo_cv_versions(id) on delete set null,
  original_name text not null, mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  stored_name text not null unique, byte_size bigint not null check (byte_size > 0), file_hash text not null,
  extraction_status text not null check (extraction_status in ('extracted','manual_review','failed')),
  extracted_data jsonb not null default '{}'::jsonb, confirmed_at timestamptz, created_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.meo_company_verifications (
  id text primary key, company_id text not null unique references public.meo_companies(id) on delete cascade,
  status text not null check (status in ('pending','verified','rejected','suspended')), source text not null,
  evidence jsonb not null default '{}'::jsonb, verified_by text references public.meo_users(id) on delete set null,
  verified_at timestamptz, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.meo_company_memberships (
  id text primary key, company_id text not null references public.meo_companies(id) on delete cascade,
  user_id text not null references public.meo_users(id) on delete cascade, role text not null check (role in ('company','manager')),
  status text not null check (status in ('active','suspended','revoked')), verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (company_id,user_id)
);
create table public.meo_employment_relationships (
  id text primary key, worker_id text not null references public.meo_users(id) on delete restrict,
  company_id text references public.meo_companies(id) on delete restrict, company_name text not null, position text not null,
  start_date date not null, end_date date, employment_status text not null check (employment_status in ('active','ended','archived')),
  verification_status text not null check (verification_status in ('self_declared','pending','verified','rejected','disputed')),
  worker_confirmed_at timestamptz, company_confirmed_at timestamptz, created_by text not null references public.meo_users(id) on delete restrict,
  created_by_role text not null check (created_by_role in ('worker','company')), retention_until timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (end_date is null or end_date >= start_date)
);
alter table public.meo_tasks add constraint meo_tasks_employment_fk foreign key (employment_id) references public.meo_employment_relationships(id) on delete restrict;
create table public.meo_employer_evaluation_reports (
  id text primary key, employment_id text not null references public.meo_employment_relationships(id) on delete restrict,
  worker_id text not null references public.meo_users(id) on delete restrict, company_id text not null references public.meo_companies(id) on delete restrict,
  author_id text not null references public.meo_users(id) on delete restrict, evaluator_role text not null,
  worker_role text not null, period_start date not null, period_end date not null,
  status text not null check (status in ('draft','submitted','corrected','superseded','withdrawn','expired')),
  assessment_context text not null default '', strengths text not null default '', improvements text not null default '', factual_experience jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0), supersedes_report_id text references public.meo_employer_evaluation_reports(id) on delete restrict,
  submitted_at timestamptz, review_expires_at timestamptz not null, retention_until timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (period_end >= period_start)
);
create table public.meo_evaluation_criteria (
  id text primary key, report_id text not null references public.meo_employer_evaluation_reports(id) on delete cascade,
  criterion text not null check (criterion in ('reliability','quality','teamwork','adaptability','safety')),
  rating integer not null check (rating between 0 and 10), context text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (report_id,criterion)
);
create table public.meo_custom_evaluation_questions (
  id text primary key, company_id text not null references public.meo_companies(id) on delete cascade,
  question_text text not null check (char_length(question_text) between 1 and 500), description text not null default '',
  category text not null default 'Perguntas da empresa', status text not null check (status in ('active','archived')),
  created_by text not null references public.meo_users(id) on delete restrict, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz
);
create table public.meo_evaluation_question_versions (
  id text primary key, question_key text not null, custom_question_id text references public.meo_custom_evaluation_questions(id) on delete set null,
  company_id text references public.meo_companies(id) on delete restrict, source text not null check (source in ('standard','custom')),
  question_text text not null, description text not null default '', category_key text not null, category_label text not null,
  scoring_definition jsonb not null, created_at timestamptz not null default now(),
  check ((source = 'standard' and company_id is null) or (source = 'custom' and company_id is not null))
);
create table public.meo_evaluation_answers (
  id text primary key, report_id text not null references public.meo_employer_evaluation_reports(id) on delete cascade,
  question_version_id text not null references public.meo_evaluation_question_versions(id) on delete restrict,
  source text not null check (source in ('standard','custom')), answer_state text not null check (answer_state in ('score','not_observed','not_applicable','unanswered')),
  score integer check (score between 0 and 10), comment text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (report_id,question_version_id), check ((answer_state = 'score' and score is not null) or (answer_state <> 'score' and score is null))
);
create table public.meo_evaluation_revisions (
  id text primary key, report_id text not null references public.meo_employer_evaluation_reports(id) on delete restrict,
  previous_report_id text not null references public.meo_employer_evaluation_reports(id) on delete restrict,
  company_id text not null references public.meo_companies(id) on delete restrict, changed_by text not null references public.meo_users(id) on delete restrict,
  reason text not null, snapshot jsonb not null, created_at timestamptz not null default now()
);
create table public.meo_company_access_grants (
  id text primary key, worker_id text not null references public.meo_users(id) on delete restrict,
  requester_company_id text not null references public.meo_companies(id) on delete restrict,
  requested_by text not null references public.meo_users(id) on delete restrict, purpose text not null,
  lawful_basis text not null check (lawful_basis in ('legitimate_interest','legal_obligation','pre_contract_steps')),
  status text not null check (status in ('pending_dpia','rejected','expired')), requested_at timestamptz not null default now(),
  expires_at timestamptz not null, decided_at timestamptz, decision_by text references public.meo_users(id) on delete set null
);
create table public.meo_worker_disputes (
  id text primary key, worker_id text not null references public.meo_users(id) on delete restrict,
  employment_id text references public.meo_employment_relationships(id) on delete restrict,
  report_id text references public.meo_employer_evaluation_reports(id) on delete restrict,
  company_id text references public.meo_companies(id) on delete restrict,
  type text not null check (type in ('correction','context','dispute','restriction','deletion','access')),
  description text not null, worker_response text not null default '', status text not null check (status in ('open','under_review','resolved','rejected')),
  resolution text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.meo_report_access_logs (
  id text primary key, worker_id text not null references public.meo_users(id) on delete restrict,
  report_id text references public.meo_employer_evaluation_reports(id) on delete set null,
  employment_id text references public.meo_employment_relationships(id) on delete set null,
  viewer_user_id text references public.meo_users(id) on delete set null, viewer_company_id text references public.meo_companies(id) on delete set null,
  action text not null, purpose text not null, lawful_basis text not null, ip text, created_at timestamptz not null default now()
);
create table public.meo_data_retention_actions (
  id text primary key, entity_type text not null, entity_id text not null, worker_id text references public.meo_users(id) on delete set null,
  action text not null check (action in ('scheduled','reviewed','restricted','redacted','deleted')), reason text not null,
  execute_after timestamptz not null, executed_at timestamptz, created_by text, created_at timestamptz not null default now()
);

create index meo_users_company_idx on public.meo_users(company_id);
create unique index meo_companies_nif_unique_idx on public.meo_companies(nif) where nif is not null;
create unique index meo_users_nif_unique_idx on public.meo_users(nif) where nif is not null;
create index meo_sessions_user_idx on public.meo_sessions(user_id);
create index meo_invites_company_idx on public.meo_invites(company_id);
create index meo_work_orders_company_idx on public.meo_work_orders(company_id);
create index meo_work_orders_company_status_idx on public.meo_work_orders(company_id,status);
create index meo_tasks_company_idx on public.meo_tasks(company_id);
create index meo_tasks_assignee_idx on public.meo_tasks(assignee_id);
create index meo_tasks_work_order_idx on public.meo_tasks(work_order_id);
create index meo_tasks_employment_idx on public.meo_tasks(employment_id) where employment_id is not null;
create index meo_tasks_scheduled_start_idx on public.meo_tasks(company_id,scheduled_start_at) where scheduled_start_at is not null;
create index meo_evidences_company_idx on public.meo_evidences(company_id);
create index meo_evidences_task_idx on public.meo_evidences(task_id);
create index meo_evidences_expires_idx on public.meo_evidences(expires_at);
create index meo_tasks_validation_due_idx on public.meo_tasks(validation_due_at);
create index meo_audit_logs_company_idx on public.meo_audit_logs(company_id);
create index meo_job_offers_company_idx on public.meo_job_offers(company_id);
create index meo_job_offers_status_idx on public.meo_job_offers(status);
create index meo_job_applications_company_idx on public.meo_job_applications(company_id);
create index meo_job_applications_worker_idx on public.meo_job_applications(worker_id);
create index meo_job_applications_offer_idx on public.meo_job_applications(job_offer_id);
create index meo_recruitment_messages_worker_idx on public.meo_recruitment_messages(worker_id,created_at);
create index meo_recruitment_messages_company_idx on public.meo_recruitment_messages(company_id,created_at);
create index meo_direct_conversations_worker_idx on public.meo_direct_conversations(worker_id,updated_at desc);
create index meo_direct_conversations_company_user_idx on public.meo_direct_conversations(company_user_id,updated_at desc);
create index meo_direct_messages_conversation_idx on public.meo_direct_messages(conversation_id,created_at);
create index meo_direct_messages_unread_idx on public.meo_direct_messages(conversation_id,created_at) where read_at is null;
create index meo_job_reports_status_idx on public.meo_job_reports(status,created_at);
create index meo_cv_versions_worker_idx on public.meo_cv_versions(worker_id,version desc);
create index meo_cv_documents_worker_idx on public.meo_cv_documents(worker_id,created_at desc) where deleted_at is null;
create index meo_employment_worker_idx on public.meo_employment_relationships(worker_id,start_date desc);
create index meo_employment_company_idx on public.meo_employment_relationships(company_id,start_date desc);
create index meo_evaluation_worker_idx on public.meo_employer_evaluation_reports(worker_id,submitted_at desc);
create index meo_evaluation_company_idx on public.meo_employer_evaluation_reports(company_id,submitted_at desc);
create unique index meo_evaluation_active_period_unique on public.meo_employer_evaluation_reports(company_id,worker_id,employment_id,period_start,period_end) where status in ('draft','submitted','corrected');
create unique index meo_custom_question_active_unique on public.meo_custom_evaluation_questions(company_id,lower(question_text)) where status = 'active';
create index meo_custom_questions_company_idx on public.meo_custom_evaluation_questions(company_id,status,created_at desc);
create index meo_evaluation_answers_report_idx on public.meo_evaluation_answers(report_id);
create index meo_evaluation_revisions_report_idx on public.meo_evaluation_revisions(report_id,created_at desc);
create index meo_disputes_worker_idx on public.meo_worker_disputes(worker_id,created_at desc);
create index meo_access_worker_idx on public.meo_company_access_grants(worker_id,requested_at desc);
create index meo_report_access_worker_idx on public.meo_report_access_logs(worker_id,created_at desc);
create index meo_retention_due_idx on public.meo_data_retention_actions(execute_after) where executed_at is null;
create index meo_users_worker_cv_published_idx
  on public.meo_users ((profile->'workerCv'->>'published'))
  where role = 'worker';

create function public.meo_enforce_global_nif_uniqueness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.nif is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.nif, 0));
  if tg_table_name = 'meo_users' then
    if exists (select 1 from public.meo_companies where nif = new.nif) then
      raise exception 'NIF already belongs to another account' using errcode = '23505', constraint = 'meo_global_nif_unique';
    end if;
  elsif exists (select 1 from public.meo_users where nif = new.nif) then
    raise exception 'NIF already belongs to another account' using errcode = '23505', constraint = 'meo_global_nif_unique';
  end if;
  return new;
end;
$$;

revoke all on function public.meo_enforce_global_nif_uniqueness() from public, anon, authenticated;
grant execute on function public.meo_enforce_global_nif_uniqueness() to service_role;

create trigger meo_companies_global_nif_unique before insert or update of nif on public.meo_companies
for each row execute function public.meo_enforce_global_nif_uniqueness();
create trigger meo_users_global_nif_unique before insert or update of nif on public.meo_users
for each row execute function public.meo_enforce_global_nif_uniqueness();

alter table public.meo_app_meta enable row level security;
alter table public.meo_companies enable row level security;
alter table public.meo_users enable row level security;
alter table public.meo_sessions enable row level security;
alter table public.meo_invites enable row level security;
alter table public.meo_work_orders enable row level security;
alter table public.meo_tasks enable row level security;
alter table public.meo_evidences enable row level security;
alter table public.meo_audit_logs enable row level security;
alter table public.meo_job_offers enable row level security;
alter table public.meo_job_applications enable row level security;

create policy "meo service role app meta access"
  on public.meo_app_meta for all to service_role
  using (true) with check (true);

create policy "meo service role company access"
  on public.meo_companies for all to service_role
  using (true) with check (true);

create policy "meo service role user access"
  on public.meo_users for all to service_role
  using (true) with check (true);

create policy "meo service role session access"
  on public.meo_sessions for all to service_role
  using (true) with check (true);

create policy "meo service role invite access"
  on public.meo_invites for all to service_role
  using (true) with check (true);

create policy "meo service role work order access"
  on public.meo_work_orders for all to service_role
  using (true) with check (true);

create policy "meo service role task access"
  on public.meo_tasks for all to service_role
  using (true) with check (true);

create policy "meo service role evidence access"
  on public.meo_evidences for all to service_role
  using (true) with check (true);

create policy "meo service role audit access"
  on public.meo_audit_logs for all to service_role
  using (true) with check (true);

create policy "meo service role job offer access"
  on public.meo_job_offers for all to service_role
  using (true) with check (true);

create policy "meo service role job application access"
  on public.meo_job_applications for all to service_role
  using (true) with check (true);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'meo_recruitment_messages','meo_direct_conversations','meo_direct_messages','meo_job_reports','meo_cv_profiles','meo_cv_versions','meo_cv_documents',
    'meo_company_verifications','meo_company_memberships','meo_employment_relationships',
    'meo_employer_evaluation_reports','meo_evaluation_criteria','meo_custom_evaluation_questions',
    'meo_evaluation_question_versions','meo_evaluation_answers','meo_evaluation_revisions','meo_company_access_grants',
    'meo_worker_disputes','meo_report_access_logs','meo_data_retention_actions'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from anon, authenticated',table_name);
    execute format('grant all on table public.%I to service_role',table_name);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)','meo service ' || table_name,table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meo-evidence',
  'meo-evidence',
  false,
  8388608,
  array['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "meo service role storage access"
  on storage.objects for all to service_role
  using (bucket_id = 'meo-evidence')
  with check (bucket_id = 'meo-evidence');

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
      'meo_audit_logs','meo_job_offers','meo_job_applications','meo_recruitment_messages','meo_direct_conversations','meo_direct_messages','meo_job_reports',
      'meo_cv_profiles','meo_cv_versions','meo_cv_documents','meo_company_verifications','meo_company_memberships',
      'meo_employment_relationships','meo_employer_evaluation_reports','meo_evaluation_criteria','meo_custom_evaluation_questions',
      'meo_evaluation_question_versions','meo_evaluation_answers','meo_evaluation_revisions',
      'meo_company_access_grants','meo_worker_disputes','meo_report_access_logs','meo_data_retention_actions'
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
revoke all on function public.meo_apply_changes(jsonb) from public,anon,authenticated;
grant execute on function public.meo_apply_changes(jsonb) to service_role;

commit;
