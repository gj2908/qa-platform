-- Audit trail for the separate admin panel (admin/), which has
-- platform-wide delete power (any user, project, or storage file) via
-- the service-role client, bypassing per-project RLS entirely. Written
-- by admin/'s own API routes.
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,       -- e.g. 'user_deleted', 'project_deleted'
  target_type text not null,  -- 'user' | 'project' | 'upload' | 'storage_file'
  target_id text,
  detail text,
  created_at timestamptz default now()
);

-- RLS enabled with no policies at all — every table in this app is RLS-
-- enabled for defense-in-depth even when, as here, only the service-role
-- client (which bypasses RLS entirely) is ever expected to touch it.
alter table admin_actions enable row level security;
