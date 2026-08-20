-- Org creation/closure moves from self-serve to admin-fulfilled: a user
-- submits a request here, a platform operator reviews it in admin/ and
-- either provisions/closes the org or rejects it. Mirrors the
-- domain_status request/fulfill shape already used on organizations.
create table organization_requests (
  id uuid primary key default gen_random_uuid(),
  requester_email text not null,
  type text not null check (type in ('create', 'close')),
  org_name text, -- set for 'create'
  org_id uuid references organizations(id) on delete cascade, -- set for 'close'
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz
);

alter table organization_requests enable row level security;

-- Requesters can see and file their own requests. No update/delete
-- policy for regular users — resolving a request (approve/reject) only
-- ever happens from admin/'s service-role client, same as
-- admin_actions/rate_limit_events elsewhere in this schema.
create policy "self read own org requests" on organization_requests
  for select using (auth.jwt() ->> 'email' = requester_email);
create policy "self create org requests" on organization_requests
  for insert with check (auth.jwt() ->> 'email' = requester_email);

-- Org creation is now admin-fulfilled, not self-serve. Removing this
-- policy is the actual enforcement — deleting main/'s create route is
-- not sufficient on its own, since a direct Supabase insert from any
-- authenticated session would otherwise still succeed.
drop policy if exists "authenticated create orgs" on organizations;
