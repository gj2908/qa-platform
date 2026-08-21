-- org_admin-authored, dismissible-per-user banner shown across every
-- project under the org. Deliberately org-scoped, not platform-wide —
-- platform-wide notices are a separate, existing admin/ concern via
-- platform_settings; this is one org's own notice to its own members.
create table org_announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index org_announcements_org_id_idx on org_announcements (org_id, created_at desc);

-- Per-user dismissal, same shape as notification_dismissals.
create table org_announcement_dismissals (
  email text not null,
  announcement_id uuid not null references org_announcements(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (email, announcement_id)
);

alter table org_announcements enable row level security;
alter table org_announcement_dismissals enable row level security;

create policy "members read org announcements" on org_announcements
  for select using (org_role(org_id) is not null);
create policy "org_admin manages org announcements" on org_announcements
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');
create policy "self manage announcement dismissals" on org_announcement_dismissals
  for all using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));
