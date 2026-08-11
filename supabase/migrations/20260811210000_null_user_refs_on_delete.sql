-- Deleting a user (e.g. from the admin panel) was failing with a bare
-- "Database error deleting user" whenever that person had ever created a
-- project, release, task, or API token — those created_by/approved_by
-- foreign keys had no ON DELETE behavior, so Postgres blocked the delete
-- outright. Losing the "created by" attribution on a deleted user's past
-- activity is an acceptable trade-off; blocking account deletion entirely
-- is not.
alter table projects drop constraint if exists projects_created_by_fkey;
alter table projects add constraint projects_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table tasks drop constraint if exists tasks_created_by_fkey;
alter table tasks add constraint tasks_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table releases drop constraint if exists releases_created_by_fkey;
alter table releases add constraint releases_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table releases drop constraint if exists releases_approved_by_fkey;
alter table releases add constraint releases_approved_by_fkey
  foreign key (approved_by) references auth.users(id) on delete set null;

alter table api_tokens drop constraint if exists api_tokens_created_by_fkey;
alter table api_tokens add constraint api_tokens_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
