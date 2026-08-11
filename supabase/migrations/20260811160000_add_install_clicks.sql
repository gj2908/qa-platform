-- Records when a signed-in project member clicks Install on the
-- distribute page — honestly "install clicks," not confirmed installs,
-- since the actual device-triggered download is never authenticated.
create table release_installs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  email text not null,
  clicked_at timestamptz default now()
);

alter table release_installs enable row level security;

create policy "members read install clicks" on release_installs
  for select using (
    exists (
      select 1 from releases
      where releases.id = release_installs.release_id
        and project_role(releases.project_id) is not null
    )
  );
-- Inserts go through the service-role client from
-- pages/api/releases/track-click.js after checking the caller is signed
-- in and a member of the release's project.
