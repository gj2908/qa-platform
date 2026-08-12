-- Crash reporting (MVP scope, no automatic symbolication — see
-- main/CLAUDE.md). Apps distributed through this platform POST caught
-- exceptions to a public endpoint (pages/api/public/crash-report.js),
-- same unauthenticated/releaseId-scoped trust model as
-- pages/api/public/report-issue.js. `signature` groups reports for dedup
-- — computed app-side as a hash of exception_type + the stack trace's
-- first line (a simple, honestly-scoped grouping heuristic, not real
-- fingerprinting across varying iOS/Android/JS stack formats).
create table crash_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  release_id uuid references releases(id) on delete set null,
  platform text not null,
  app_version text,
  build_number text,
  exception_type text not null,
  message text,
  stack_trace text,
  device_model text,
  os_version text,
  signature text not null,
  created_at timestamptz default now()
);

create index crash_reports_project_signature_idx on crash_reports (project_id, signature);
create index crash_reports_project_created_idx on crash_reports (project_id, created_at desc);

alter table crash_reports enable row level security;

create policy "members read crash reports" on crash_reports
  for select using (project_role(project_id) is not null);
