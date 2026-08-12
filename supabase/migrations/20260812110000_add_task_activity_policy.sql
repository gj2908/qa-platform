-- Lets project members log their own task events (created/assigned/
-- completed/overdue/mentioned) directly from the browser client, the
-- same way board.js already writes `tasks` itself — project_activity
-- was previously service-role-write-only.
create policy "members log task activity" on project_activity
  for insert with check (project_role(project_id) in ('owner', 'editor', 'commenter'));
