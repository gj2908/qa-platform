-- Tracks whether the task-due-date cron has already nudged this task, so
-- it only fires once per task (see pages/api/cron/task-due-check.js).
alter table tasks add column due_reminder_sent_at timestamptz;
