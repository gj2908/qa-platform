-- Optional due date for a task, set via the task detail dialog.
alter table tasks add column if not exists due_date date;
