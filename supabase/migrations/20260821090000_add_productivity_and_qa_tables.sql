-- Personal productivity + QA tooling tables: notification preferences,
-- saved board views, task templates, lightweight time tracking, test
-- cases/runs, and a screenshot attachment on tester-feedback tasks.

alter table profiles add column avatar_url text;

-- ── Notification preferences ────────────────────────────────
-- Per-user override of a project's default notification behavior (the
-- project-level digest_enabled/release_emails_enabled toggles still set
-- the default for everyone; a row here overrides it for just that user).
-- No row = defaults apply, same as before this table existed.
create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  muted boolean not null default false,
  email_enabled boolean not null default true,
  created_at timestamptz default now(),
  unique (user_id, project_id)
);

-- ── Saved board views ────────────────────────────────────────
-- Per-user filter presets on a project's kanban board (status/assignee/
-- label/priority filters), not shared with other collaborators.
create table saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── Task templates ───────────────────────────────────────────
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  default_labels text[] not null default '{}',
  default_priority text check (default_priority is null or default_priority in ('low', 'medium', 'high', 'urgent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Lightweight time tracking ────────────────────────────────
create table task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_email text not null,
  minutes int not null check (minutes > 0),
  note text,
  logged_on date not null default current_date,
  created_at timestamptz default now()
);

create index task_time_entries_task_id_idx on task_time_entries (task_id);

-- ── Test cases + runs ────────────────────────────────────────
-- A test case is project-scoped and reusable across releases; a run
-- records its pass/fail outcome against one specific release.
create table test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  steps text,
  expected_result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table test_case_runs (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references test_cases(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'not_run' check (status in ('pass', 'fail', 'blocked', 'not_run')),
  notes text,
  run_by text, -- actor email; kept even if the account is later removed
  run_at timestamptz default now()
);

create index test_case_runs_release_id_idx on test_case_runs (release_id);
create index test_case_runs_test_case_id_idx on test_case_runs (test_case_id);

-- ── Feedback screenshot ──────────────────────────────────────
-- Optional screenshot attached to a tester-feedback task (see
-- pages/api/public/report-issue.js). Storage path only, resolved to a
-- signed URL on read (same private-bucket-by-default posture as builds).
alter table tasks add column screenshot_path text;

-- ── RLS ───────────────────────────────────────────────────────
alter table notification_preferences enable row level security;
alter table saved_views enable row level security;
alter table task_templates enable row level security;
alter table task_time_entries enable row level security;
alter table test_cases enable row level security;
alter table test_case_runs enable row level security;

-- notification_preferences / saved_views: personal, owned entirely by
-- the row's own user_id — still gated on current project membership so
-- a removed collaborator can't keep a live row via a stale project_id.
create policy "own notification prefs" on notification_preferences
  for all using (user_id = auth.uid() and project_role(project_id) is not null)
  with check (user_id = auth.uid() and project_role(project_id) is not null);

create policy "own saved views" on saved_views
  for all using (user_id = auth.uid() and project_role(project_id) is not null)
  with check (user_id = auth.uid() and project_role(project_id) is not null);

create policy "members read task templates" on task_templates
  for select using (project_role(project_id) is not null);
create policy "editor+ write task templates" on task_templates
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

create policy "members read time entries" on task_time_entries
  for select using (project_role(project_id) is not null);
create policy "commenter+ write own time entries" on task_time_entries
  for insert with check (
    project_role(project_id) in ('owner', 'editor', 'commenter')
    and user_email = (auth.jwt() ->> 'email')
  );
create policy "author deletes own time entries" on task_time_entries
  for delete using (user_email = (auth.jwt() ->> 'email'));

create policy "members read test cases" on test_cases
  for select using (project_role(project_id) is not null);
create policy "editor+ write test cases" on test_cases
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

create policy "members read test runs" on test_case_runs
  for select using (project_role(project_id) is not null);
create policy "commenter+ write test runs" on test_case_runs
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));
