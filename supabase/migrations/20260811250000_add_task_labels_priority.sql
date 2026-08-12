-- Free-text labels + a priority level on board tasks. Plain columns
-- rather than a separate labels table — a handful of free-text tags per
-- task doesn't need a join table.
alter table tasks add column if not exists priority text
  check (priority is null or priority in ('low', 'medium', 'high', 'urgent'));
alter table tasks add column if not exists labels text[] not null default '{}';
