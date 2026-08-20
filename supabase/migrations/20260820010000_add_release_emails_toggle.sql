-- Per-project opt-in email notification on release publish, mirroring
-- the existing digest_enabled/require_approval toggle pattern.
alter table projects add column release_emails_enabled boolean not null default false;
