-- Funnel's "viewed" stage, sitting above install_events' "installed"
-- stage. Written from share/[id].js's getServerSideProps on a successful
-- (non-gated) render, where a real browser User-Agent is available —
-- unlike manifest.js/download.js's install-click endpoints, which are hit
-- by OS-level installer processes with much less useful UA strings. This
-- is also the source of device/OS breakdown data, for the same reason.
create table page_view_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade, -- same as install_events: anonymous/no-project releases aren't tracked at all
  device_model text,
  os_name text,
  os_version text,
  created_at timestamptz default now()
);

create index page_view_events_project_created_idx on page_view_events (project_id, created_at);

alter table page_view_events enable row level security;

create policy "members read page views" on page_view_events
  for select using (project_role(project_id) is not null);
