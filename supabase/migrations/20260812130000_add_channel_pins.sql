-- Holds a channel+platform to a specific release instead of always
-- resolving to "latest published" — see pages/channel/[projectId]/[channel].js.
create table channel_pins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  channel text not null check (channel in ('internal', 'beta', 'production')),
  platform text not null check (platform in ('ios', 'android', 'web')),
  release_id uuid not null references releases(id) on delete cascade,
  pinned_by uuid references auth.users(id) on delete set null,
  pinned_at timestamptz default now(),
  unique (project_id, channel, platform)
);

alter table channel_pins enable row level security;

create policy "members read channel pins" on channel_pins
  for select using (project_role(project_id) is not null);
create policy "owner write channel pins" on channel_pins
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');
