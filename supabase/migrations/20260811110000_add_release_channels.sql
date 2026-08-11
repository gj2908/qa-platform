-- Release channels/tracks: testers can install "the latest beta" or "the
-- latest internal build" via a stable channel link (pages/channel/...)
-- instead of hunting for the newest version in the changelog.
alter table releases add column if not exists channel text not null default 'production'
  check (channel in ('internal', 'beta', 'production'));
