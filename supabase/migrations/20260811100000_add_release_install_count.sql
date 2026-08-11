-- Counts install attempts per release: incremented server-side in
-- pages/api/manifest.js (iOS) and pages/api/download/[id].js
-- (android/web redirect-through endpoint).
alter table releases add column install_count integer not null default 0;

create or replace function increment_install_count(p_release_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update releases set install_count = install_count + 1 where id = p_release_id;
$$;
