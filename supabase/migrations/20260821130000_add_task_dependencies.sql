-- "blocked_task depends on blocking_task" — a lightweight blocker link
-- between two tasks in the same project. No cross-table trigger enforcing
-- both rows share a project_id (low-stakes invariant, left to app code,
-- same trust level as e.g. task_comments.project_id not being re-derived
-- from task_id via trigger). No server-side enforcement blocking a
-- blocked task from moving to 'done' either — the UI warns, it doesn't
-- hard-block, matching this app's general "RLS + UI hints, not workflow
-- engine" posture elsewhere on the board.
create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blocking_task_id uuid not null references tasks(id) on delete cascade,
  blocked_task_id uuid not null references tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (blocking_task_id <> blocked_task_id),
  unique (blocking_task_id, blocked_task_id)
);
create index task_dependencies_blocked_idx on task_dependencies (blocked_task_id);
create index task_dependencies_blocking_idx on task_dependencies (blocking_task_id);

alter table task_dependencies enable row level security;

create policy "members read task dependencies" on task_dependencies
  for select using (project_role(project_id) is not null);
create policy "commenter+ write task dependencies" on task_dependencies
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));
