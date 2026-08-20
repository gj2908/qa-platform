-- Project-scoped feature flags with percentage rollout, resolved for a
-- given device using the same stable device-hash bucketing already used
-- for staged release rollout (lib/deviceBucket.js) — see
-- pages/api/v1/feature-flags.js.
create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  description text,
  enabled boolean not null default true,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (project_id, key)
);

alter table feature_flags enable row level security;

create policy "members read feature flags" on feature_flags
  for select using (project_role(project_id) is not null);
create policy "editor+ write feature flags" on feature_flags
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));
