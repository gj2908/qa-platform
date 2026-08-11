-- Tracks the last time each user "read" their notification bell, so the
-- bell can compute an unread count against project_activity without a
-- separate read/unread flag per activity row. One global timestamp per
-- user (not per-project) — simplest thing that works.
create table notification_read_state (
  email text primary key,
  last_read_at timestamptz not null default now()
);

alter table notification_read_state enable row level security;

create policy "self read own read-state" on notification_read_state
  for select using (auth.jwt() ->> 'email' = email);
create policy "self upsert own read-state" on notification_read_state
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);
