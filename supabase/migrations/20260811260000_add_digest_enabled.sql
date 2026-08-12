-- Per-project toggle for the email digest feature (lib/buildDigest.js,
-- pages/api/projects/send-digest.js, pages/api/cron/digest.js).
alter table projects add column if not exists digest_enabled boolean not null default false;
