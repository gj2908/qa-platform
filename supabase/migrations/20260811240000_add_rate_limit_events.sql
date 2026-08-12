-- Lightweight DB-backed rate limiting for the anonymous public POST
-- endpoints (no Redis/queue infra in this app) — a row per attempt,
-- keyed by "<endpoint>:<ip-or-email>"; a count-in-window query decides
-- whether to allow the next attempt. See lib/rateLimit.js.
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  created_at timestamptz default now()
);

create index rate_limit_events_key_created_idx on rate_limit_events (key, created_at desc);

-- RLS enabled with no policies — service-role only, same as admin_actions.
alter table rate_limit_events enable row level security;
