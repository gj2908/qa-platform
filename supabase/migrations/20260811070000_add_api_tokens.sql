-- Project-scoped API tokens for CI/CD build publishing (Authorization:
-- Bearer <token>), an alternative to the interactive session-based
-- upload flow. Only a hash is ever stored — the raw token is shown once
-- at creation time and never persisted or retrievable again.
create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,  -- first 8 chars, shown in the UI for identification
  label text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  last_used_at timestamptz
);

alter table api_tokens enable row level security;

create policy "owner manages tokens" on api_tokens
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');
