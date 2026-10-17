-- Percurso Profissional e Avaliações: perguntas versionadas, rascunhos e revisões imutáveis.

alter table public.meo_employer_evaluation_reports
  add column if not exists evaluator_role text,
  add column if not exists worker_role text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists strengths text not null default '',
  add column if not exists improvements text not null default '';

update public.meo_employer_evaluation_reports r
set evaluator_role = coalesce(r.evaluator_role, 'company'),
    worker_role = coalesce(r.worker_role, e.position),
    period_start = coalesce(r.period_start, e.start_date),
    period_end = coalesce(r.period_end, e.end_date, r.created_at::date)
from public.meo_employment_relationships e
where e.id = r.employment_id;

alter table public.meo_employer_evaluation_reports
  alter column evaluator_role set not null,
  alter column worker_role set not null,
  alter column period_start set not null,
  alter column period_end set not null,
  drop constraint if exists meo_evaluation_period_valid,
  add constraint meo_evaluation_period_valid check (period_end >= period_start);

create table if not exists public.meo_custom_evaluation_questions (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  question_text text not null check (char_length(question_text) between 1 and 500),
  description text not null default '',
  category text not null default 'Perguntas da empresa',
  status text not null check (status in ('active','archived')),
  created_by text not null references public.meo_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists meo_custom_question_active_unique
  on public.meo_custom_evaluation_questions(company_id, lower(question_text)) where status = 'active';

create table if not exists public.meo_evaluation_question_versions (
  id text primary key,
  question_key text not null,
  custom_question_id text references public.meo_custom_evaluation_questions(id) on delete set null,
  company_id text references public.meo_companies(id) on delete restrict,
  source text not null check (source in ('standard','custom')),
  question_text text not null,
  description text not null default '',
  category_key text not null,
  category_label text not null,
  scoring_definition jsonb not null,
  created_at timestamptz not null default now(),
  check ((source = 'standard' and company_id is null) or (source = 'custom' and company_id is not null))
);

create table if not exists public.meo_evaluation_answers (
  id text primary key,
  report_id text not null references public.meo_employer_evaluation_reports(id) on delete cascade,
  question_version_id text not null references public.meo_evaluation_question_versions(id) on delete restrict,
  source text not null check (source in ('standard','custom')),
  answer_state text not null check (answer_state in ('score','not_observed','not_applicable','unanswered')),
  score integer check (score between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, question_version_id),
  check ((answer_state = 'score' and score is not null) or (answer_state <> 'score' and score is null)),
  check (not (answer_state = 'score' and score in (1,2) and btrim(comment) = ''))
);

create table if not exists public.meo_evaluation_revisions (
  id text primary key,
  report_id text not null references public.meo_employer_evaluation_reports(id) on delete restrict,
  previous_report_id text not null references public.meo_employer_evaluation_reports(id) on delete restrict,
  company_id text not null references public.meo_companies(id) on delete restrict,
  changed_by text not null references public.meo_users(id) on delete restrict,
  reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists meo_evaluation_active_period_unique
  on public.meo_employer_evaluation_reports(company_id, worker_id, employment_id, period_start, period_end)
  where status in ('draft','submitted','corrected');
create index if not exists meo_custom_questions_company_idx on public.meo_custom_evaluation_questions(company_id, status, created_at desc);
create index if not exists meo_evaluation_answers_report_idx on public.meo_evaluation_answers(report_id);
create index if not exists meo_evaluation_revisions_report_idx on public.meo_evaluation_revisions(report_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['meo_custom_evaluation_questions','meo_evaluation_question_versions','meo_evaluation_answers','meo_evaluation_revisions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', 'meo service ' || table_name, table_name);
  end loop;
end $$;

create or replace function public.meo_apply_changes(changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  change jsonb; table_name text; key_column text; current_row jsonb; expected_row jsonb;
  columns_sql text; values_sql text; updates_sql text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meo_apply_changes', 0));
  for change in select value from pg_catalog.jsonb_array_elements(changes) loop
    table_name := change->>'table';
    if not (table_name = any(array[
      'meo_companies','meo_users','meo_sessions','meo_invites','meo_work_orders','meo_tasks','meo_evidences','meo_audit_logs',
      'meo_job_offers','meo_job_applications','meo_recruitment_messages','meo_job_reports','meo_cv_profiles','meo_cv_versions',
      'meo_cv_documents','meo_company_verifications','meo_company_memberships','meo_employment_relationships',
      'meo_employer_evaluation_reports','meo_evaluation_criteria','meo_custom_evaluation_questions',
      'meo_evaluation_question_versions','meo_evaluation_answers','meo_evaluation_revisions','meo_company_access_grants',
      'meo_worker_disputes','meo_report_access_logs','meo_data_retention_actions'
    ])) then raise exception 'Invalid table'; end if;
    key_column := case when table_name = 'meo_sessions' then 'token_hash' else 'id' end;
    execute format('select to_jsonb(t) from public.%I t where %I = $1', table_name, key_column) into current_row using change->>'id';
    if change->'before' is distinct from 'null'::jsonb then
      execute format('select to_jsonb(r) from jsonb_populate_record(null::public.%I, $1) r', table_name) into expected_row using change->'before';
      if current_row is distinct from expected_row then raise exception using errcode='40001', message='Concurrent update'; end if;
    elsif current_row is not null then raise exception using errcode='40001', message='Concurrent insert'; end if;
    if change->'after' = 'null'::jsonb then
      execute format('delete from public.%I where %I = $1', table_name, key_column) using change->>'id';
    else
      select string_agg(format('%I', key), ', '), string_agg(format('r.%I', key), ', '), string_agg(format('%I = excluded.%I', key, key), ', ')
        into columns_sql, values_sql, updates_sql from pg_catalog.jsonb_object_keys(change->'after') key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r on conflict (%I) do update set %s', table_name, columns_sql, values_sql, table_name, key_column, updates_sql) using change->'after';
    end if;
  end loop;
end;
$$;

revoke all on function public.meo_apply_changes(jsonb) from public, anon, authenticated;
grant execute on function public.meo_apply_changes(jsonb) to service_role;
