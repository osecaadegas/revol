-- Worker CV profiles are stored in meo_users.profile->workerCv.
-- The app uses this for worker-owned CV publishing and company-side candidate review.

alter table if exists public.meo_users
  add column if not exists profile jsonb not null default '{}'::jsonb;

update public.meo_users
set profile = '{}'::jsonb
where profile is null;

create index if not exists meo_users_worker_cv_published_idx
  on public.meo_users ((profile->'workerCv'->>'published'))
  where role = 'worker';
