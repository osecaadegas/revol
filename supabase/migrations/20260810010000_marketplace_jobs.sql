-- Marketplace correction: public vacancies, worker accounts, company accounts,
-- and applications.

alter table public.meo_companies
  add column if not exists location text,
  add column if not exists website text,
  add column if not exists sector text,
  add column if not exists description text;

alter table public.meo_users
  drop constraint if exists meo_users_role_check;

alter table public.meo_users
  add constraint meo_users_role_check
  check (role in ('manager', 'employee', 'contractor', 'worker', 'company'));

alter table public.meo_users
  add column if not exists profile jsonb not null default '{}'::jsonb;

create table if not exists public.meo_job_offers (
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

alter table public.meo_job_offers
  add column if not exists position text;

create table if not exists public.meo_job_applications (
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

create index if not exists meo_job_offers_company_idx on public.meo_job_offers(company_id);
create index if not exists meo_job_offers_status_idx on public.meo_job_offers(status);
create index if not exists meo_job_applications_company_idx on public.meo_job_applications(company_id);
create index if not exists meo_job_applications_worker_idx on public.meo_job_applications(worker_id);
create index if not exists meo_job_applications_offer_idx on public.meo_job_applications(job_offer_id);

alter table public.meo_job_offers enable row level security;
alter table public.meo_job_applications enable row level security;

drop policy if exists "meo service role job offer access" on public.meo_job_offers;
drop policy if exists "meo service role job application access" on public.meo_job_applications;

create policy "meo service role job offer access"
  on public.meo_job_offers for all to service_role
  using (true) with check (true);

create policy "meo service role job application access"
  on public.meo_job_applications for all to service_role
  using (true) with check (true);
