-- DB-backed admin allowlist, additive to the ADMIN_EMAILS env var (union
-- of both grants access — see admin/lib/supabase.js's isAdminEmail()).
-- Service-role only, same defense-in-depth pattern as admin_actions.
create table admin_allowlist (
  email text primary key,
  added_by text not null,
  added_at timestamptz default now()
);

alter table admin_allowlist enable row level security;
