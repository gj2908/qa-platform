-- Per-browser Web Push subscriptions, keyed by email like
-- notification_read_state/project_favorites. A user can subscribe from
-- multiple browsers/devices, each getting its own row (endpoint is
-- unique per subscription).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "self manage push subscriptions" on push_subscriptions
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);
