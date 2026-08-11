-- Per-user starred projects, shown pinned to the top of the dashboard.
create table project_favorites (
  email text not null,
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (email, project_id)
);

alter table project_favorites enable row level security;

create policy "self manage favorites" on project_favorites
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);
