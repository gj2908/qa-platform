-- A task assigned to the whole team instead of one person. Mutually
-- exclusive with assignee_email — application code (TaskDetailDialog.js's
-- save(), board.js's saveTaskDetails/bulkSetAssignee) is responsible for
-- clearing assignee_email whenever this is set true, and vice versa; no
-- DB-level CHECK enforces the exclusivity, same posture as other
-- app-enforced (not DB-enforced) invariants in this schema.
alter table tasks
  add column assigned_to_team boolean not null default false;
