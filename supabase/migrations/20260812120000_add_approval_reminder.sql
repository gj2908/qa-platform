-- Tracks whether the pending-review-aging cron has already nudged this
-- release, so it only fires once per release (see pages/api/cron/pending-review-check.js).
alter table releases add column approval_reminder_sent_at timestamptz;
