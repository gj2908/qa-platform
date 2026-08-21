-- Lets admin/'s browser-side client (session-based, not service-role)
-- read every pending org request for a live-updating nav badge — the
-- existing "self read own org requests" policy only ever showed a
-- caller their own rows, which is fine for main/'s "my request status"
-- use but useless for admin/'s cross-tenant request queue.
--
-- Only covers admin_allowlist (DB table), not the ADMIN_EMAILS env var
-- fallback — Postgres has no visibility into that env var. An
-- env-var-only admin still sees correct counts on page load (server-side
-- via the service-role client, unaffected by RLS) but won't get live
-- updates from the realtime subscription. Documented in admin/CLAUDE.md.
create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admin_allowlist where email = (auth.jwt() ->> 'email')
  );
$$;

create policy "platform admins read all org requests" on organization_requests
  for select using (is_platform_admin());

alter publication supabase_realtime add table organization_requests;
