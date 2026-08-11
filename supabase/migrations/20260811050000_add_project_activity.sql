-- Per-project activity log — releases published/deleted, collaborator
-- changes, webhook updates — surfaced as a "Recent activity" timeline on
-- the project Overview page.
create table project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_email text not null,
  action text not null,  -- e.g. 'release_published', 'collaborator_added'
  detail text,             -- human-readable one-liner, e.g. "v1.2 (34) for iOS"
  created_at timestamptz default now()
);

alter table project_activity enable row level security;
create policy "members read activity" on project_activity
  for select using (project_role(project_id) is not null);
-- No insert/update/delete policy for normal clients — rows are only ever
-- written by trusted server routes via the service-role client, after
-- those routes have already checked the caller's permission for the
-- action being logged (same trust model as releases/webhook writes).
