-- Require a canonical Portuguese tax identifier for new public worker/company
-- registrations. Existing accounts remain nullable until they are reviewed.

alter table public.meo_companies
  add column if not exists nif text;

alter table public.meo_users
  add column if not exists nif text;

create or replace function public.meo_is_valid_nif(input text)
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

-- Preserve already collected company identifiers when they are unambiguous.
with candidates as (
  select id, recruitment->>'nif' as nif,
    count(*) over (partition by recruitment->>'nif') as occurrences
  from public.meo_companies
  where public.meo_is_valid_nif(recruitment->>'nif')
)
update public.meo_companies as company
set nif = candidates.nif
from candidates
where company.id = candidates.id
  and candidates.occurrences = 1
  and company.nif is null;

alter table public.meo_companies
  drop constraint if exists meo_companies_nif_format_check;
alter table public.meo_companies
  add constraint meo_companies_nif_format_check
  check (nif is null or public.meo_is_valid_nif(nif));

alter table public.meo_users
  drop constraint if exists meo_users_nif_format_check;
alter table public.meo_users
  add constraint meo_users_nif_format_check
  check (nif is null or public.meo_is_valid_nif(nif));

create unique index if not exists meo_companies_nif_unique_idx
  on public.meo_companies(nif)
  where nif is not null;

create unique index if not exists meo_users_nif_unique_idx
  on public.meo_users(nif)
  where nif is not null;

-- A NIF identifies either one company registration or one worker account. The
-- transaction advisory lock closes the cross-table race between concurrent
-- registrations before the opposite table is checked.
create or replace function public.meo_enforce_global_nif_uniqueness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.nif is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.nif, 0));

  if tg_table_name = 'meo_users' then
    if exists (select 1 from public.meo_companies where nif = new.nif) then
      raise exception 'NIF already belongs to another account'
        using errcode = '23505', constraint = 'meo_global_nif_unique';
    end if;
  elsif exists (select 1 from public.meo_users where nif = new.nif) then
    raise exception 'NIF already belongs to another account'
      using errcode = '23505', constraint = 'meo_global_nif_unique';
  end if;

  return new;
end;
$$;

revoke all on function public.meo_enforce_global_nif_uniqueness() from public, anon, authenticated;
grant execute on function public.meo_enforce_global_nif_uniqueness() to service_role;

drop trigger if exists meo_companies_global_nif_unique on public.meo_companies;
create trigger meo_companies_global_nif_unique
before insert or update of nif on public.meo_companies
for each row execute function public.meo_enforce_global_nif_uniqueness();

drop trigger if exists meo_users_global_nif_unique on public.meo_users;
create trigger meo_users_global_nif_unique
before insert or update of nif on public.meo_users
for each row execute function public.meo_enforce_global_nif_uniqueness();
