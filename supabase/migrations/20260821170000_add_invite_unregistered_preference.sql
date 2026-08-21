-- Per-adder preference for what happens when they add a not-yet-registered
-- email as a project collaborator or org member: ask each time (default),
-- always send the invite-to-signup email silently, or never send it.
-- Lives on profiles (one row per real account) alongside avatar_url/
-- full_name, not per-project/org — it's a property of the person doing
-- the adding, not of what's being added to.
alter table profiles
  add column invite_unregistered_preference text not null default 'ask'
  check (invite_unregistered_preference in ('ask', 'always', 'never'));
