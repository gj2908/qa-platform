-- Simple key/value store for thresholds that would otherwise be hardcoded
-- constants (approval-reminder hours, rate-limit caps) — read by
-- lib/rateLimit.js and the cron routes, edited from admin/pages/settings.js.
-- Service-role only, same defense-in-depth pattern as admin_actions/rate_limit_events.
create table platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table platform_settings enable row level security;
