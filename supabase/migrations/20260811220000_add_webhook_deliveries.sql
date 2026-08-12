-- Records every outgoing webhook attempt (release/feedback/collaborator
-- events), so a failed delivery isn't silently swallowed — surfaced as a
-- "Recent deliveries" list on the project Overview page with a retry
-- action for failures.
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event text not null,
  payload jsonb,
  status text not null check (status in ('success', 'failed')),
  response_status int,
  error text,
  created_at timestamptz default now()
);

create index webhook_deliveries_project_created_idx on webhook_deliveries (project_id, created_at desc);

alter table webhook_deliveries enable row level security;

create policy "members read webhook deliveries" on webhook_deliveries
  for select using (project_role(project_id) is not null);
-- Inserts are service-role only, same trust model as project_activity.
