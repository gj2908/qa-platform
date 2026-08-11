-- Manually-submitted iOS device UDIDs, so a developer doesn't have to
-- email/Slack testers to ask for theirs before regenerating an Ad Hoc
-- provisioning profile. Submitted anonymously via a public form.
create table registered_devices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  udid text not null,
  device_name text,
  submitted_by_email text,
  created_at timestamptz default now()
);

alter table registered_devices enable row level security;

create policy "members read devices" on registered_devices
  for select using (project_role(project_id) is not null);
create policy "editor+ manage devices" on registered_devices
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));
-- Public inserts go through the service-role client from
-- pages/api/public/register-device.js, same trust model as tester
-- feedback — no insert policy needed for the anon/authenticated roles.
