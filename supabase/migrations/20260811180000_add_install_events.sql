-- Per-event install log (as opposed to releases.install_count, which is
-- just a running total) so the Overview page can chart real day-by-day
-- install trends and version-adoption breakdowns. Written best-effort
-- alongside the existing increment_install_count() calls.
create table install_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  platform text not null,
  created_at timestamptz default now()
);

create index install_events_project_created_idx on install_events (project_id, created_at);

alter table install_events enable row level security;

create policy "members read install events" on install_events
  for select using (project_role(project_id) is not null);
-- Inserts are service-role only (manifest.js / api/download), same
-- trust model as project_activity.
