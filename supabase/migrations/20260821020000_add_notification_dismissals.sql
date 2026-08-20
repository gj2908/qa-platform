-- Per-user notification dismissals. project_activity itself is shared
-- team history (can't be deleted just because one person cleared their
-- bell) — this is a separate, purely personal "hide this from my list"
-- marker, same email-keyed self-management shape as
-- notification_read_state/push_subscriptions.
create table notification_dismissals (
  email text not null,
  activity_id uuid not null references project_activity(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (email, activity_id)
);

alter table notification_dismissals enable row level security;

create policy "self manage notification dismissals" on notification_dismissals
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);
