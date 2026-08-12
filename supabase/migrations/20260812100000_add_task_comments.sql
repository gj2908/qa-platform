-- A discussion thread per task. RLS mirrors tasks' own policies exactly
-- (see "members read tasks" / "commenter+ write tasks").
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz default now()
);

create index task_comments_task_id_idx on task_comments (task_id, created_at);

alter table task_comments enable row level security;

create policy "members read task comments" on task_comments
  for select using (project_role(project_id) is not null);
create policy "commenter+ write task comments" on task_comments
  for insert with check (project_role(project_id) in ('owner', 'editor', 'commenter'));
