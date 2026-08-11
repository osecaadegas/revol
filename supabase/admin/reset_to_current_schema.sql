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

create table public.meo_companies (
  id text primary key,
  name text not null,
  location text,
  website text,
  sector text,
  description text,
  created_at timestamptz not null
);

create table public.meo_users (
  id text primary key,
  company_id text not null references public.meo_companies(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('manager', 'employee', 'contractor', 'worker', 'company')),
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
  role text not null check (role in ('manager', 'employee', 'contractor', 'worker', 'company')),
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
);

create table public.meo_job_applications (
  id text primary key,
  job_offer_id text not null references public.meo_job_offers(id) on delete cascade,
  company_id text not null references public.meo_companies(id) on delete cascade,
  worker_id text not null references public.meo_users(id) on delete cascade,
  worker_name text not null,
  worker_email text not null,
  message text,
  status text not null check (status in ('submitted', 'reviewed', 'accepted', 'rejected')),
  decision_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (job_offer_id, worker_id)
);

create index meo_users_company_idx on public.meo_users(company_id);
create index meo_sessions_user_idx on public.meo_sessions(user_id);
create index meo_invites_company_idx on public.meo_invites(company_id);
create index meo_work_orders_company_idx on public.meo_work_orders(company_id);
create index meo_tasks_company_idx on public.meo_tasks(company_id);
create index meo_tasks_assignee_idx on public.meo_tasks(assignee_id);
create index meo_tasks_work_order_idx on public.meo_tasks(work_order_id);
create index meo_evidences_company_idx on public.meo_evidences(company_id);
create index meo_evidences_task_idx on public.meo_evidences(task_id);
create index meo_audit_logs_company_idx on public.meo_audit_logs(company_id);
create index meo_job_offers_company_idx on public.meo_job_offers(company_id);
create index meo_job_offers_status_idx on public.meo_job_offers(status);
create index meo_job_applications_company_idx on public.meo_job_applications(company_id);
create index meo_job_applications_worker_idx on public.meo_job_applications(worker_id);
create index meo_job_applications_offer_idx on public.meo_job_applications(job_offer_id);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meo-evidence',
  'meo-evidence',
  false,
  6291456,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "meo service role storage access"
  on storage.objects for all to service_role
  using (bucket_id = 'meo-evidence')
  with check (bucket_id = 'meo-evidence');

commit;
