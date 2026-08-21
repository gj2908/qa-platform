-- Owner-controlled, read-only, unguessable-token share of a project's
-- board, mirroring organizations.invite_token's capability-token shape —
-- an anonymous roadmap visitor has no row-level identity, so a real RLS
-- role check isn't available; possession of the token is the whole
-- authorization, same as share/[id].js's release id.
--
-- A dedicated roadmap_token (not the project's own id) so disabling and
-- regenerating a leaked/no-longer-wanted roadmap link doesn't require
-- rotating the project's id, which already appears in plenty of other
-- non-secret contexts (URLs, webhooks, logs).
alter table projects add column roadmap_enabled boolean not null default false;
alter table projects add column roadmap_token uuid not null default gen_random_uuid();
create unique index projects_roadmap_token_idx on projects (roadmap_token);
