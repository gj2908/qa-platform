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
  release_emails_enabled boolean not null default false, -- real-time email on release_published, separate from the digest
  legal_hold boolean not null default false, -- blocks deletion, see guard_legal_hold() below
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
-- projects.org_id is added further down, once the "Organizations" table
-- it references exists (see "Organizations" section below) — a
-- from-scratch run of this file is still top-to-bottom order-dependent.

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
  screenshot_path text, -- optional feedback screenshot, "feedback" storage bucket, see pages/api/public/report-issue.js
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

-- ── Task dependencies ────────────────────────────────────────
-- "blocked_task depends on blocking_task" — a lightweight blocker link
-- between two tasks in the same project. No cross-table trigger enforcing
-- both rows share a project_id (low-stakes invariant, left to app code).
-- No server-side enforcement blocking a blocked task from moving to
-- 'done' either — the UI warns, it doesn't hard-block, matching this
-- app's general "RLS + UI hints, not workflow engine" posture.
create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blocking_task_id uuid not null references tasks(id) on delete cascade,
  blocked_task_id uuid not null references tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (blocking_task_id <> blocked_task_id),
  unique (blocking_task_id, blocked_task_id)
);
create index task_dependencies_blocked_idx on task_dependencies (blocked_task_id);
create index task_dependencies_blocking_idx on task_dependencies (blocking_task_id);

-- ── Task templates ───────────────────────────────────────────
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  default_labels text[] not null default '{}',
  default_priority text check (default_priority is null or default_priority in ('low', 'medium', 'high', 'urgent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Lightweight time tracking ────────────────────────────────
create table task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_email text not null,
  minutes int not null check (minutes > 0),
  note text,
  logged_on date not null default current_date,
  created_at timestamptz default now()
);

create index task_time_entries_task_id_idx on task_time_entries (task_id);

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

-- ── Test cases + runs ────────────────────────────────────────
-- A test case is project-scoped and reusable across releases; a run
-- records its pass/fail outcome against one specific release.
create table test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  steps text,
  expected_result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table test_case_runs (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references test_cases(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'not_run' check (status in ('pass', 'fail', 'blocked', 'not_run')),
  notes text,
  run_by text, -- actor email; kept even if the account is later removed
  run_at timestamptz default now()
);

create index test_case_runs_release_id_idx on test_case_runs (release_id);
create index test_case_runs_test_case_id_idx on test_case_runs (test_case_id);

-- ── Feature flags ────────────────────────────────────────────
-- Project-scoped, with percentage rollout resolved for a given device
-- using the same stable device-hash bucketing already used for staged
-- release rollout (lib/deviceBucket.js) — see pages/api/v1/feature-flags.js.
create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  description text,
  enabled boolean not null default true,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (project_id, key)
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
  -- One-time reverification flag for accounts that existed before email
  -- verification shipped — independent of auth.users.email_confirmed_at,
  -- which is already set for them (auto-confirmed under the old config)
  -- and so can't distinguish "genuinely verified" from "grandfathered in."
  -- Defaults false: new signups already verify via the signup flow itself.
  needs_reverification boolean not null default false,
  reverified_at timestamptz,
  avatar_url text, -- pasted image URL, same convention as organizations.logo_url — no upload flow/Storage bucket
  -- What to do when this person adds a not-yet-registered email as a
  -- project collaborator or org member: ask each time (default), always
  -- send the invite-to-signup email silently, or never send it. A
  -- property of the adder, not of what's being added to.
  invite_unregistered_preference text not null default 'ask'
    check (invite_unregistered_preference in ('ask', 'always', 'never')),
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up. Reads full_name
-- from the signup-time options.data payload; null if not provided.
-- Also auto-joins the new signup into any organization whose domain
-- matches their email, but only if that org's domain has actually been
-- connected (domain_status = 'connected') — never for a purely
-- display-only domain, which is the whole reason domain_status exists
-- as a separate field.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  email_domain := split_part(new.email, '@', 2);
  insert into org_members (org_id, email, role)
  select id, new.email, 'member'
  from organizations
  where domain = email_domain and domain_status = 'connected'
  on conflict (org_id, email) do nothing;

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
  -- Optional — only populated by server-side call sites with a req object.
  -- Client-inserted rows (task lifecycle events) leave these null.
  actor_ip text,
  actor_user_agent text,
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

-- ── Notification dismissals ─────────────────────────────────
-- Per-user "hide this from my bell" marker — project_activity itself is
-- shared team history and never deleted just because one person
-- cleared their notifications.
create table notification_dismissals (
  email text not null,
  activity_id uuid not null references project_activity(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (email, activity_id)
);

-- ── Notification preferences ────────────────────────────────
-- Per-user override of a project's default notification behavior (the
-- project-level digest_enabled/release_emails_enabled toggles still set
-- the default for everyone; a row here overrides it for just that user).
-- No row = defaults apply, same as before this table existed.
create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  muted boolean not null default false,
  email_enabled boolean not null default true,
  created_at timestamptz default now(),
  unique (user_id, project_id)
);

-- ── Saved board views ────────────────────────────────────────
-- Per-user filter presets on a project's kanban board, not shared with
-- other collaborators.
create table saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── Push subscriptions ──────────────────────────────────────
-- Per-browser Web Push subscriptions, keyed by email like
-- notification_read_state/project_favorites above. A user can subscribe
-- from multiple browsers/devices, each getting its own row.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
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
  scope text not null default 'publish' check (scope in ('read', 'publish')), -- 'read' can't publish releases, see lib/verifyApiToken.js callers
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- ── Org-level API tokens ─────────────────────────────────────
-- Deliberately a separate table, not a nullable api_tokens.project_id —
-- every /api/v1/*.js and /api/ci/releases/create.js caller assumes
-- verifyApiToken() returns a row scoped to a single project; a separate
-- table keeps that existing contract untouched. scope is hard-
-- constrained to 'read' at the DB level — an org token that could
-- publish would let one leaked token publish to any project in the org.
create table org_api_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  label text,
  scope text not null default 'read' check (scope = 'read'),
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

-- ── Page view events ─────────────────────────────────────────
-- Funnel's "viewed" stage, sitting above install_events' "installed"
-- stage. Written from share/[id].js on a successful (non-gated) render,
-- where a real browser User-Agent is available — unlike manifest.js/
-- download.js's install-click endpoints, which are hit by OS-level
-- installer processes with much less useful UA strings. Also the source
-- of device/OS breakdown data, for the same reason.
create table page_view_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  device_model text,
  os_name text,
  os_version text,
  created_at timestamptz default now()
);

create index page_view_events_project_created_idx on page_view_events (project_id, created_at);

-- ── Crash reports ────────────────────────────────────────────
-- MVP scope, no automatic symbolication — see main/CLAUDE.md. Apps
-- distributed through this platform POST caught exceptions to a public
-- endpoint (pages/api/public/crash-report.js), same unauthenticated/
-- releaseId-scoped trust model as pages/api/public/report-issue.js.
-- `signature` groups reports for dedup — computed app-side as a hash of
-- exception_type + the stack trace's first line (a simple, honestly-
-- scoped grouping heuristic, not real fingerprinting across varying
-- iOS/Android/JS stack formats).
create table crash_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  release_id uuid references releases(id) on delete set null,
  platform text not null,
  app_version text,
  build_number text,
  exception_type text not null,
  message text,
  stack_trace text,
  device_model text,
  os_version text,
  signature text not null,
  created_at timestamptz default now()
);

create index crash_reports_project_signature_idx on crash_reports (project_id, signature);
create index crash_reports_project_created_idx on crash_reports (project_id, created_at desc);

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

-- ── Organizations ────────────────────────────────────────────
-- A grouping layer above projects, for companies/teams that want shared
-- membership + seat management across several projects. Purely additive —
-- projects.org_id is nullable, so ungrouped/personal projects are
-- unaffected. org_members mirrors project_collaborators' shape (email-keyed
-- so someone can be added before they've signed up), but unlike a
-- project's strictly-singleton owner, an org can have multiple org_admins.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  seat_limit integer, -- null = unlimited; enforced by trg_guard_seat_limit below
  -- White-label branding (v1: accent color + light mode only, plain URL —
  -- no derived palette/dark-mode override, no upload flow/Storage bucket).
  -- Flat typed columns, matching projects.webhook_url's precedent.
  logo_url text,
  accent_color text,
  domain text, -- display-only unless connected; see handle_new_user() for the domain-verified auto-join it then enables
  domain_status text check (domain_status in ('pending', 'connected')), -- null = display-only; set when an admin requests real connection, see admin/'s fulfillment flow
  default_webhook_url text, -- one-time copy onto a project's webhook_url at org attach (only if it has none yet) AND, ongoing, a live fan-out target: every webhook-notifying event also fires here independently (best-effort, see lib/webhookNotify.js's notifyProjectWebhooks) whenever the project belongs to this org, in addition to the project's own webhook_url
  default_require_approval boolean not null default false,
  -- Self-serve invite link (org_admin toggles on/off, can regenerate to
  -- invalidate previously shared links). Distinct from domain-verified
  -- auto-join above: no DNS/domain ownership required, works instantly.
  invite_token uuid not null default gen_random_uuid(),
  invite_enabled boolean not null default false,
  -- Org-wide policy: every member must have a verified TOTP factor to
  -- use the app at all, checked client-side by
  -- components/layout/RequireMfaGate.js (Supabase Auth's MFA enrollment
  -- itself is a free-tier feature; this column is just the org's policy
  -- switch on top of it).
  mfa_required boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create unique index organizations_invite_token_idx on organizations (invite_token);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('org_admin', 'member')),
  created_at timestamptz default now(),
  unique (org_id, email)
);

-- Org creation/closure is admin-fulfilled, not self-serve — a user
-- files a request here, a platform operator reviews it in admin/.
-- Mirrors the domain_status request/fulfill shape.
create table organization_requests (
  id uuid primary key default gen_random_uuid(),
  requester_email text not null,
  type text not null check (type in ('create', 'close')),
  org_name text,
  -- set null (not cascade) so the request row survives the org's
  -- deletion — approving a 'close' request must not erase its own
  -- audit trail from the admin queue.
  org_id uuid references organizations(id) on delete set null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz
);

-- Org-level audit trail — member/branding/domain/lifecycle changes.
-- Kept separate from project_activity (not-null project_id, scoped to
-- one project by design) rather than loosening that column's contract.
create table org_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_email text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index org_activity_org_id_idx on org_activity (org_id, created_at desc);

-- set null (not cascade): deleting an org must not delete its member
-- projects, only ungroup them.
alter table projects add column org_id uuid references organizations(id) on delete set null;
create index projects_org_id_idx on projects (org_id);

-- ── Public roadmap ───────────────────────────────────────────
-- Owner-controlled, read-only, unguessable-token share of a project's
-- board, mirroring organizations.invite_token's capability-token shape.
-- A dedicated roadmap_token (not the project's own id) so disabling and
-- regenerating a leaked link doesn't require rotating the project's id.
alter table projects add column roadmap_enabled boolean not null default false;
alter table projects add column roadmap_token uuid not null default gen_random_uuid();
create unique index projects_roadmap_token_idx on projects (roadmap_token);

-- ── Org announcements ────────────────────────────────────────
-- org_admin-authored, dismissible-per-user banner shown across every
-- project under the org. Org-scoped, not platform-wide (that's the
-- existing admin/ platform_settings concern).
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

-- ── Role lookup helpers ──────────────────────────────────────
-- security definer + owned by the migration role (which owns the tables it
-- queries) so this bypasses project_collaborators' own RLS instead of
-- recursing into it.
--
-- Rewritten (not just extended) so that an org_admin automatically gets
-- 'owner'-equivalent access to every project under their org, without
-- editing the ~15 other RLS policies that already call project_role() —
-- they all pick up org-derived access for free. A direct
-- project_collaborators row always takes precedence when both exist.
create or replace function project_role(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role from project_collaborators
     where project_id = p_project_id and email = (auth.jwt() ->> 'email')
     limit 1),
    (select 'owner' from projects p
     join org_members om on om.org_id = p.org_id and om.role = 'org_admin'
     where p.id = p_project_id and om.email = (auth.jwt() ->> 'email')
     limit 1)
  );
$$;

-- Mirrors project_role() exactly, for org-scoped RLS (org settings,
-- members, org-level activity export).
create or replace function org_role(p_org_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from org_members
  where org_id = p_org_id
    and email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- Lets admin/'s session-based browser client (not just its service-role
-- server client) see cross-tenant rows an ordinary user-scoped policy
-- wouldn't allow — currently just organization_requests, for a live nav
-- badge. Only covers admin_allowlist (DB table), not the ADMIN_EMAILS
-- env var fallback — Postgres has no visibility into that env var.
create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admin_allowlist where email = (auth.jwt() ->> 'email')
  );
$$;

-- Auto-assign the creator as org_admin, mirroring assign_project_owner().
create or replace function assign_org_admin()
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
    insert into org_members (org_id, email, role)
    values (new.id, creator_email, 'org_admin')
    on conflict (org_id, email) do update set role = 'org_admin';
  end if;
  return new;
end;
$$;

create trigger trg_assign_org_admin
  after insert on organizations
  for each row execute function assign_org_admin();

-- Blocks removing/demoting the last org_admin, so an org can never become
-- unmanageable — mirrors transfer_project_ownership()'s invariant guard.
-- Skips the guard when the organizations row itself no longer exists —
-- that means the whole org is being deleted (which cascades to its
-- org_members rows, firing this BEFORE DELETE trigger on each one), not a
-- standalone member removal, so there's nothing left to protect. Without
-- this check, deleting an org is impossible: every org always has >=1
-- org_admin by design, so the cascade always looks like "removing the last
-- admin."
create or replace function guard_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE' and old.role = 'org_admin')
     or (TG_OP = 'UPDATE' and old.role = 'org_admin' and new.role <> 'org_admin') then
    if not exists (select 1 from organizations where id = old.org_id) then
      return coalesce(new, old);
    end if;
    if (select count(*) from org_members where org_id = old.org_id and role = 'org_admin') <= 1 then
      raise exception 'An organization must have at least one org_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_guard_last_org_admin
  before update or delete on org_members
  for each row execute function guard_last_org_admin();

-- Seat management: a "seat" is one org_members row regardless of role.
-- seat_limit is a manually set integer (null = unlimited), enforced at the
-- DB layer to match this schema's existing preference for DB-enforced
-- invariants over app-only validation. No billing/metering plumbing —
-- seat_limit is edited only by org_admins (org settings UI) or admin/
-- (platform override).
create or replace function guard_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  limit_val integer;
begin
  select seat_limit into limit_val from organizations where id = new.org_id;
  if limit_val is not null then
    select count(*) into current_count from org_members where org_id = new.org_id;
    if current_count >= limit_val then
      raise exception 'Organization seat limit (%) reached', limit_val;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_seat_limit
  before insert on org_members
  for each row execute function guard_seat_limit();

-- Belt-and-suspenders like guard_seat_limit() above — the UI already
-- hides the delete action for a held project, but a direct RLS-permitted
-- delete (owner role) must fail here too.
create or replace function guard_legal_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.legal_hold then
    raise exception 'This project is under legal hold and cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger trg_guard_legal_hold
  before delete on projects
  for each row execute function guard_legal_hold();

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
alter table notification_dismissals enable row level security;
alter table push_subscriptions enable row level security;
alter table api_tokens enable row level security;
alter table project_favorites enable row level security;
alter table registered_devices enable row level security;
alter table release_installs enable row level security;
alter table install_events enable row level security;
alter table page_view_events enable row level security;
alter table crash_reports enable row level security;
alter table webhook_deliveries enable row level security;
alter table admin_actions enable row level security;
alter table rate_limit_events enable row level security;
alter table task_comments enable row level security;
alter table task_templates enable row level security;
alter table task_time_entries enable row level security;
alter table test_cases enable row level security;
alter table test_case_runs enable row level security;
alter table feature_flags enable row level security;
alter table notification_preferences enable row level security;
alter table saved_views enable row level security;
alter table channel_pins enable row level security;
alter table platform_settings enable row level security;
alter table admin_allowlist enable row level security;
alter table organizations enable row level security;
alter table org_members enable row level security;

create policy "members read orgs" on organizations
  for select using (org_role(id) is not null);
create policy "org_admin update orgs" on organizations
  for update using (org_role(id) = 'org_admin') with check (org_role(id) = 'org_admin');
-- No insert policy for regular users as of the organization_requests
-- change below — org creation is admin-fulfilled, not self-serve, so
-- this is now enforced at the RLS layer too, not just by removing the
-- UI button (a direct Supabase insert from an authenticated session
-- must fail here, not just be inconvenient to reach). admin/'s
-- service-role client bypasses RLS entirely and is unaffected.
-- No delete policy for regular users either — org deletion isn't
-- exposed in main/'s UI; admin/'s service-role client can do it.

create policy "members read org members" on org_members
  for select using (org_role(org_id) is not null);
create policy "org_admin manages org members" on org_members
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');

alter table organization_requests enable row level security;
create policy "self read own org requests" on organization_requests
  for select using (auth.jwt() ->> 'email' = requester_email);
create policy "self create org requests" on organization_requests
  for insert with check (auth.jwt() ->> 'email' = requester_email);
create policy "platform admins read all org requests" on organization_requests
  for select using (is_platform_admin());
-- No update/delete policy for regular users — resolving a request only
-- ever happens from admin/'s service-role client.

-- Realtime: admin/'s nav badge subscribes to inserts/updates here so a
-- new or resolved request shows up live without a page refresh.
alter publication supabase_realtime add table organization_requests;

alter table org_activity enable row level security;
create policy "members read org activity" on org_activity
  for select using (org_role(org_id) is not null);
create policy "members write org activity" on org_activity
  for insert with check (org_role(org_id) is not null);

alter table org_announcements enable row level security;
create policy "members read org announcements" on org_announcements
  for select using (org_role(org_id) is not null);
create policy "org_admin manages org announcements" on org_announcements
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');

alter table org_announcement_dismissals enable row level security;
create policy "self manage announcement dismissals" on org_announcement_dismissals
  for all using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));

create policy "members read webhook deliveries" on webhook_deliveries
  for select using (project_role(project_id) is not null);
-- admin_actions, rate_limit_events, platform_settings, and
-- admin_allowlist get no policies at all — service-role only, same as
-- project_activity's write side.

create policy "members read task comments" on task_comments
  for select using (project_role(project_id) is not null);
create policy "commenter+ write task comments" on task_comments
  for insert with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

alter table task_dependencies enable row level security;
create policy "members read task dependencies" on task_dependencies
  for select using (project_role(project_id) is not null);
create policy "commenter+ write task dependencies" on task_dependencies
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

create policy "members read task templates" on task_templates
  for select using (project_role(project_id) is not null);
create policy "editor+ write task templates" on task_templates
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

create policy "members read time entries" on task_time_entries
  for select using (project_role(project_id) is not null);
create policy "commenter+ write own time entries" on task_time_entries
  for insert with check (
    project_role(project_id) in ('owner', 'editor', 'commenter')
    and user_email = (auth.jwt() ->> 'email')
  );
create policy "author deletes own time entries" on task_time_entries
  for delete using (user_email = (auth.jwt() ->> 'email'));

create policy "members read test cases" on test_cases
  for select using (project_role(project_id) is not null);
create policy "editor+ write test cases" on test_cases
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

create policy "members read test runs" on test_case_runs
  for select using (project_role(project_id) is not null);
create policy "commenter+ write test runs" on test_case_runs
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

create policy "members read feature flags" on feature_flags
  for select using (project_role(project_id) is not null);
create policy "editor+ write feature flags" on feature_flags
  for all using (project_role(project_id) in ('owner', 'editor'))
  with check (project_role(project_id) in ('owner', 'editor'));

-- notification_preferences / saved_views: personal, owned entirely by
-- the row's own user_id — still gated on current project membership so
-- a removed collaborator can't keep a live row via a stale project_id.
create policy "own notification prefs" on notification_preferences
  for all using (user_id = auth.uid() and project_role(project_id) is not null)
  with check (user_id = auth.uid() and project_role(project_id) is not null);

create policy "own saved views" on saved_views
  for all using (user_id = auth.uid() and project_role(project_id) is not null)
  with check (user_id = auth.uid() and project_role(project_id) is not null);

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

create policy "members read page views" on page_view_events
  for select using (project_role(project_id) is not null);

create policy "members read crash reports" on crash_reports
  for select using (project_role(project_id) is not null);

create policy "self read own read-state" on notification_read_state
  for select using (auth.jwt() ->> 'email' = email);
create policy "self upsert own read-state" on notification_read_state
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);

create policy "self manage notification dismissals" on notification_dismissals
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);

create policy "self manage push subscriptions" on push_subscriptions
  for all using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);

create policy "owner manages tokens" on api_tokens
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

alter table org_api_tokens enable row level security;
create policy "org_admin manages org tokens" on org_api_tokens
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');

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

-- ── Storage bucket for feedback screenshots ─────────────────
-- Create manually in Supabase dashboard: Storage → New bucket → "feedback" → Private.
-- Same signed-URL-only access model as "builds". Client-side JPEG
-- compression keeps individual screenshots small (free-tier storage is
-- capped at 1GB total) — see components/release/ReportIssueCard.js.
