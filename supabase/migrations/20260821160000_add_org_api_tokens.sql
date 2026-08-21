-- Org-level API tokens — deliberately a separate table, not a nullable
-- api_tokens.project_id. Every existing /api/v1/*.js and
-- /api/ci/releases/create.js caller assumes verifyApiToken() returns a
-- row scoped to a single project; loosening that column's contract
-- would force an audit of every such call site. A separate table keeps
-- the existing api_tokens path completely untouched.
--
-- scope is hard-constrained to 'read' at the DB level (not just in app
-- code) — an org-scoped token that could publish would let one leaked
-- token publish to *any* project in the org, a far larger blast radius
-- than today's single-project publish tokens.
create table org_api_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  label text,
  scope text not null default 'read' check (scope = 'read'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

alter table org_api_tokens enable row level security;
create policy "org_admin manages org tokens" on org_api_tokens
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');
