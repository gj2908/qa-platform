-- Org-level audit trail: member add/remove, branding/domain changes,
-- and lifecycle events (create/close requested/approved) — none of
-- this was logged anywhere before. Kept separate from project_activity
-- (whose project_id is not-null and scoped to a single project by
-- design) rather than loosening that column's contract.
create table org_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_email text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index org_activity_org_id_idx on org_activity (org_id, created_at desc);

alter table org_activity enable row level security;

create policy "members read org activity" on org_activity
  for select using (org_role(org_id) is not null);
create policy "members write org activity" on org_activity
  for insert with check (org_role(org_id) is not null);
