-- First-class private project viewer roles.
-- client/developer can access private MANIFESTO project and MVP cockpit views.

alter table public.meo_users
  drop constraint if exists meo_users_role_check;

alter table public.meo_users
  add constraint meo_users_role_check
  check (role in ('manager', 'employee', 'contractor', 'worker', 'company', 'client', 'developer'));

alter table public.meo_invites
  drop constraint if exists meo_invites_role_check;

alter table public.meo_invites
  add constraint meo_invites_role_check
  check (role in ('manager', 'employee', 'contractor', 'worker', 'company', 'client', 'developer'));
