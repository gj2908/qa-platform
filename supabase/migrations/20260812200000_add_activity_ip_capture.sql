-- Optional actor context for project_activity rows written by server-side
-- call sites that have a req object. Client-inserted rows (task lifecycle
-- events) leave these null — no req object available there.
alter table project_activity add column actor_ip text;
alter table project_activity add column actor_user_agent text;
