-- Opt-in, per-device Web Push subscriptions. Push endpoints are credentials,
-- so only the application server's service role may read or change them.
create table if not exists public.meo_push_subscriptions (
  id text primary key,
  user_id text not null references public.meo_users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  updated_at timestamptz not null default now(),
  check (char_length(endpoint) <= 2048)
);
create index if not exists meo_push_subscriptions_user on public.meo_push_subscriptions(user_id);
alter table public.meo_push_subscriptions enable row level security;
revoke all on public.meo_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.meo_push_subscriptions to service_role;
create policy "meo service push subscriptions" on public.meo_push_subscriptions
  for all to service_role using (true) with check (true);
