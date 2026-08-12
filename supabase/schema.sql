-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ── Projects ────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  webhook_url text, -- optional Slack-incoming-webhook-compatible URL, notified on publish
  require_approval boolean not null default false, -- non-owner publishes land as pending_review
  digest_enabled boolean not null default false, -- lib/buildDigest.js / pages/api/cron/digest.js
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Project collaborators ───────────────────────────────────
-- Keyed by email (not user id) so an owner can add someone before they've
-- ever signed up. Roles are Google-Drive-style: viewer (install + view
-- only), commenter (+ board access), editor (+ publish/delete releases),
-- owner (+ manage collaborators, transfer ownership, delete the project).
create table project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'editor', 'commenter', 'viewer')),
  created_at timestamptz default now(),
  unique (project_id, email)
);

create unique index one_owner_per_project on project_collaborators (project_id) where role = 'owner';

-- ── Tasks (kanban board) ───────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog', 'todo', 'in_progress', 'review', 'done')),
  position int default 0,
  assignee_email text,
  due_date date,
  source text not null default 'manual' check (source in ('manual', 'tester_feedback')),
  ai_category text check (ai_category is null or ai_category in ('bug', 'feature', 'question')),
  ai_severity text check (ai_severity is null or ai_severity in ('low', 'medium', 'high')),
  priority text check (priority is null or priority in ('low', 'medium', 'high', 'urgent')),
  labels text[] not null default '{}',
  due_reminder_sent_at timestamptz, -- see pages/api/cron/task-due-check.js, fires once
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Task comments ────────────────────────────────────────────
-- A discussion thread per task. RLS mirrors tasks' own policies.
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz default now()
);

create index task_comments_task_id_idx on task_comments (task_id, created_at);

-- ── Releases (changelog + QA distribution) ─────────────────
create table releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade, -- null for public, no-login uploads
  platform text not null check (platform in ('ios', 'android', 'web')),
  version text not null,
  build_number text,
  bundle_id text,          -- required for iOS manifest generation
  notes text,               -- release notes, markdown
  file_path text,           -- storage path, for ios/android
  web_url text,             -- direct link, for web platform
  app_name text,             -- extracted from the ipa/apk (or site title), or user-entered fallback
  app_icon text,             -- base64 data URI, extracted from the ipa/apk or site favicon
  min_os_version text,       -- extracted from the ipa/apk
  file_size_bytes bigint,    -- extracted from the ipa/apk
  device_family text,        -- extracted from the ipa (e.g. "iPhone, iPad")
  uploader_email text,       -- set for releases from the public, no-login upload landing page
  install_count integer not null default 0, -- incremented server-side (manifest.js / api/download)
  channel text not null default 'production' check (channel in ('internal', 'beta', 'production')),
  share_expires_at timestamptz,  -- optional share-link expiry
  share_pin_hash text,           -- optional share-link PIN, sha256 hash only
  rollout_percent integer check (rollout_percent is null or (rollout_percent >= 1 and rollout_percent <= 99)),
  scheduled_for timestamptz,     -- lazily activated, see lib/activateScheduledRelease.js
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'published'
    check (status in ('draft', 'published', 'scheduled', 'pending_review')),
  approval_reminder_sent_at timestamptz, -- see pages/api/cron/pending-review-check.js, fires once
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Channel pins ─────────────────────────────────────────────
-- Holds a channel+platform to a specific release instead of always
-- resolving to "latest published" — see pages/channel/[projectId]/[channel].js.
create table channel_pins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  channel text not null check (channel in ('internal', 'beta', 'production')),
  platform text not null check (platform in ('ios', 'android', 'web')),
  release_id uuid not null references releases(id) on delete cascade,
  pinned_by uuid references auth.users(id) on delete set null,
  pinned_at timestamptz default now(),
  unique (project_id, channel, platform)
);

-- ── Profiles ─────────────────────────────────────────────────
-- A public-facing display name for a user, so collaborators on a shared
-- project can see who "jane@company.com" actually is instead of just
-- their email. full_name is null until the user sets one (at sign-up or
-- later in Settings) — every UI site must fall back to email when null.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up. Reads full_name
-- from the signup-time options.data payload; null if not provided.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Project activity log ────────────────────────────────────
-- Releases published/deleted, collaborator changes, webhook updates —
-- surfaced as a "Recent activity" timeline on the project Overview page.
create table project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_email text not null,
  action text not null,  -- e.g. 'release_published', 'collaborator_added'
  detail text,             -- human-readable one-liner, e.g. "v1.2 (34) for iOS"
  created_at timestamptz default now()
);

-- ── Notification read state ─────────────────────────────────
-- Tracks the last time each user "read" their notification bell, so the
-- bell can compute an unread count against project_activity without a
-- separate read/unread flag per activity row.
create table notification_read_state (
  email text primary key,
  last_read_at timestamptz not null default now()
);

-- ── API tokens (CI/CD publishing) ───────────────────────────
-- Project-scoped tokens for non-interactive release publishing
-- (Authorization: Bearer <token>). Only a hash is ever stored — the raw
-- token is shown once at creation and never persisted or retrievable.
create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,  -- first 8 chars, shown in the UI for identification
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- ── Project favorites ───────────────────────────────────────
-- Per-user starred projects, pinned to the top of the dashboard.
create table project_favorites (
  email text not null,
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (email, project_id)
);

-- Atomic install counter increment (Supabase-js can't do `col = col + 1`
-- from the client directly).
create or replace function increment_install_count(p_release_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update releases set install_count = install_count + 1 where id = p_release_id;
$$;

-- ── Registered devices ───────────────────────────────────────
-- Manually-submitted iOS device UDIDs, so a developer doesn't have to
-- email/Slack testers to ask for theirs before regenerating an Ad Hoc
-- provisioning profile. Submitted anonymously via a public form.
create table registered_devices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  udid text not null,
  device_name text,
  submitted_by_email text,
  created_at timestamptz default now()
);

-- ── Install clicks ───────────────────────────────────────────
-- Honestly "install clicks," not confirmed installs — the actual
-- device-triggered download is never authenticated.
create table release_installs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  email text not null,
  clicked_at timestamptz default now()
);

-- ── Install events ───────────────────────────────────────────
-- Per-event log (vs. releases.install_count's running total) powering
-- the Overview page's install-trend chart and version-adoption breakdown.
create table install_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  platform text not null,
  created_at timestamptz default now()
);

create index install_events_project_created_idx on install_events (project_id, created_at);

-- ── Webhook deliveries ───────────────────────────────────────
-- Records every outgoing webhook attempt so a failed delivery isn't
-- silently swallowed — "Recent deliveries" list + retry on the project
-- Overview page.
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event text not null,
  payload jsonb,
  status text not null check (status in ('success', 'failed')),
  response_status int,
  error text,
  created_at timestamptz default now()
);

create index webhook_deliveries_project_created_idx on webhook_deliveries (project_id, created_at desc);

-- ── Admin audit log ──────────────────────────────────────────
-- Written by the separate admin/ app's service-role client only — no RLS
-- policies, just enabled for defense-in-depth like every other table.
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  detail text,
  created_at timestamptz default now()
);

-- ── Rate limiting ────────────────────────────────────────────
-- DB-backed throttle for anonymous public POST endpoints — a row per
-- attempt, keyed by "<endpoint>:<ip-or-email>". See lib/rateLimit.js.
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  created_at timestamptz default now()
);

create index rate_limit_events_key_created_idx on rate_limit_events (key, created_at desc);

-- ── Platform settings ────────────────────────────────────────
-- Key/value overrides for thresholds that would otherwise be hardcoded
-- constants (approval-reminder hours, rate-limit caps). Read by
-- lib/rateLimit.js and the cron routes, edited from admin/pages/settings.js.
-- Service-role only, same as admin_actions.
create table platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- ── Admin allowlist ──────────────────────────────────────────
-- DB-backed admin allowlist, additive to the ADMIN_EMAILS env var (union
-- of both grants access — see admin/lib/supabase.js's isAdminEmail()).
-- Service-role only, same as admin_actions.
create table admin_allowlist (
  email text primary key,
  added_by text not null,
  added_at timestamptz default now()
);

-- ── Role lookup helper ──────────────────────────────────────
-- security definer + owned by the migration role (which owns the tables it
-- queries) so this bypasses project_collaborators' own RLS instead of
-- recursing into it.
create or replace function project_role(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from project_collaborators
  where project_id = p_project_id
    and email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- Auto-assign the creator as owner whenever a project is created.
create or replace function assign_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_email text;
begin
  select email into creator_email from auth.users where id = new.created_by;
  if creator_email is not null then
    insert into project_collaborators (project_id, email, role)
    values (new.id, creator_email, 'owner')
    on conflict (project_id, email) do update set role = 'owner';
  end if;
  return new;
end;
$$;

create trigger trg_assign_project_owner
  after insert on projects
  for each row execute function assign_project_owner();

-- Transfers ownership atomically (the new owner must already be a
-- collaborator) so the "one owner per project" index is never violated and
-- a failure never leaves a project ownerless.
create or replace function transfer_project_ownership(p_project_id uuid, p_new_owner_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := (auth.jwt() ->> 'email');
  is_owner boolean;
begin
  select exists(
    select 1 from project_collaborators
    where project_id = p_project_id and email = caller_email and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if not exists (
    select 1 from project_collaborators where project_id = p_project_id and email = p_new_owner_email
  ) then
    raise exception 'That person must already be a collaborator on this project';
  end if;

  update project_collaborators set role = 'editor' where project_id = p_project_id and role = 'owner';
  update project_collaborators set role = 'owner' where project_id = p_project_id and email = p_new_owner_email;
end;
$$;

-- ── Row Level Security ──────────────────────────────────────
-- A project (and its tasks/releases) is only visible to its owner and
-- explicitly added collaborators — nobody else. Role determines write
-- access: viewer is read-only, commenter can use the board, editor can
-- also publish/delete releases, owner can also manage collaborators and
-- delete the project.

alter table projects enable row level security;
alter table tasks enable row level security;
alter table releases enable row level security;
alter table project_collaborators enable row level security;
alter table profiles enable row level security;
alter table project_activity enable row level security;
alter table notification_read_state enable row level security;
alter table api_tokens enable row level security;
alter table project_favorites enable row level security;
alter table registered_devices enable row level security;
alter table release_installs enable row level security;
alter table install_events enable row level security;
alter table webhook_deliveries enable row level security;
alter table admin_actions enable row level security;
alter table rate_limit_events enable row level security;
alter table task_comments enable row level security;
alter table channel_pins enable row level security;
alter table platform_settings enable row level security;
alter table admin_allowlist enable row level security;

create policy "members read webhook deliveries" on webhook_deliveries
  for select using (project_role(project_id) is not null);
-- admin_actions, rate_limit_events, platform_settings, and
-- admin_allowlist get no policies at all — service-role only, same as
-- project_activity's write side.

create policy "members read task comments" on task_comments
  for select using (project_role(project_id) is not null);
create policy "commenter+ write task comments" on task_comments
  for insert with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

create policy "members read channel pins" on channel_pins
  for select using (project_role(project_id) is not null);
create policy "owner write channel pins" on channel_pins
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

create policy "members read devices" on registered_devices
  for select using (project_role(project_id) is not null);
create policy "editor+ manage devices" on registered_devices
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

create policy "members read install clicks" on release_installs
  for select using (
    exists (
      select 1 from releases
      where releases.id = release_installs.release_id
        and project_role(releases.project_id) is not null
    )
  );

create policy "members read install events" on install_events
  for select using (project_role(project_id) is not null);

create policy "self read own read-state" on notification_read_state
  for select using (auth.jwt() ->> 'email' = email);
create policy "self upsert own read-state" on notification_read_state
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);

create policy "owner manages tokens" on api_tokens
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

create policy "self manage favorites" on project_favorites
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);

create policy "members read activity" on project_activity
  for select using (project_role(project_id) is not null);
-- Release/collaborator/webhook events are still only ever written by
-- trusted server routes via the service-role client. This insert policy
-- additionally lets project members log their own task events (created/
-- assigned/completed/overdue/mentioned) directly from the browser client,
-- the same way board.js already writes `tasks` itself.
create policy "members log task activity" on project_activity
  for insert with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

create policy "authenticated read profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "self update profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "members read collaborators" on project_collaborators
  for select using (project_role(project_id) is not null);
create policy "owner manages collaborators" on project_collaborators
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

create policy "members read projects" on projects
  for select using (project_role(id) is not null);
create policy "authenticated create projects" on projects
  for insert with check (auth.role() = 'authenticated');
create policy "owner update projects" on projects
  for update using (project_role(id) = 'owner') with check (true);
create policy "owner delete projects" on projects
  for delete using (project_role(id) = 'owner');

create policy "members read tasks" on tasks
  for select using (project_role(project_id) is not null);
create policy "commenter+ write tasks" on tasks
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

-- project_id is null for public, no-login uploads — those are governed by
-- uploader_email instead of project membership.
create policy "members read releases" on releases
  for select using (
    (project_id is not null and project_role(project_id) is not null)
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );
create policy "editor+ write releases" on releases
  for all using (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  )
  with check (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );

-- ── Storage bucket for build files ──────────────────────────
-- Create manually in Supabase dashboard: Storage → New bucket → "builds" → Private.
-- Access is only ever via signed URLs generated server-side (service role key),
-- never exposed directly to the browser.
