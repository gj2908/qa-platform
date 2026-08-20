-- Org-level defaults, applied to a project only when it's attached to
-- the org and doesn't already have its own value set (never overwrites
-- an existing per-project choice) — see set-org.js.
alter table organizations add column default_webhook_url text;
alter table organizations add column default_require_approval boolean not null default false;
