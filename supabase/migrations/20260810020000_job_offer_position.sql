-- Adds a dedicated vacancy function/role field for marketplace filtering.

alter table public.meo_job_offers
  add column if not exists position text;
