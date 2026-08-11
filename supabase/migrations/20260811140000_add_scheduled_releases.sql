-- Scheduled releases: a release can be inserted with status 'scheduled'
-- and a future scheduled_for; it lazily flips to 'published' (firing the
-- normal activity/webhook) the next time any page reads it past that
-- time — see lib/activateScheduledRelease.js. No background cron needed.
alter table releases add column if not exists scheduled_for timestamptz;

alter table releases drop constraint if exists releases_status_check;
alter table releases add constraint releases_status_check
  check (status in ('draft', 'published', 'scheduled'));
