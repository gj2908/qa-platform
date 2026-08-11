-- Staged/phased rollout: null means 100% (everyone), otherwise the
-- percentage of anonymous share-link visitors (bucketed by a per-visitor
-- cookie) who see this release instead of the previous one.
alter table releases add column if not exists rollout_percent integer
  check (rollout_percent is null or (rollout_percent >= 1 and rollout_percent <= 99));
