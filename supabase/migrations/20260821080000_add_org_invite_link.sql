-- Self-serve org invite links: an org_admin can share a link that lets
-- anyone with it join the org as a plain member, without a platform
-- operator or a verified domain in the loop (that's what domain-verified
-- auto-join / handle_new_user() is for — this is the lighter-weight,
-- instant alternative for orgs that never connect a domain).
alter table organizations
  add column invite_token uuid not null default gen_random_uuid(),
  add column invite_enabled boolean not null default false;

create unique index organizations_invite_token_idx on organizations (invite_token);
