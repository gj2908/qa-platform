# Changelog

Reverse-chronological summary of what's shipped, grouped by theme. See
`git log` for the literal commit history this is built from.

## 2026-08-21 — Organization lifecycle governance

- Self-serve org creation is gone — a user now files a create or close
  **request** (`organization_requests`), reviewed and fulfilled by a
  platform operator from a new `admin/` queue (`/organizations/requests`).
  Approving a create request provisions the org with `created_by` set to
  the *requester*, so `assign_org_admin()`'s trigger correctly makes them
  (not the operator running the approval) the org's first `org_admin`.
  Self-serve creation is also blocked at the RLS layer, not just hidden
  in the UI.
- Caught in verification: `organization_requests.org_id` was `on delete
  cascade` against `organizations`, so approving a close request would
  delete the org and silently cascade-delete the request row *about*
  that closure before it could be marked `approved` — erasing the
  closure's own audit trail from the admin queue. Switched to `on delete
  set null`; the request row now survives and renders the org as
  "already gone."
- Added `org_activity`, an org-level audit log (member add/remove,
  branding/domain changes, project attach, lifecycle events) merged by
  timestamp into the org dashboard's existing cross-project activity
  feed, so "Recent activity" reads as one unified history.
- Org admins can set default `webhook_url`/`require_approval` values
  that fill in for a project only when it doesn't already have its own
  (never overwrites an existing per-project setting).
- Domain-verified auto-join: a signup whose email domain matches an
  org's domain — only once that domain's `domain_status` is
  `'connected'`, not merely `'pending'` — is added to that org as a
  plain `member` automatically, via `handle_new_user()`.
- Added a role & permissions reference page (`/docs/permissions`),
  linked from both a project's Collaborators page and the org
  dashboard, documenting how project roles and org roles combine.
- Org member invites and project attachment both accept multiple
  entries at once now (paste several emails; select several projects)
  instead of one at a time.
- The command palette (Cmd/Ctrl+K) scopes results to the current org's
  projects when searching from within that org's own pages.
- The org dashboard now warns once a seat limit has 1 or 0 seats left,
  ahead of an add actually failing against the seat-limit trigger.

## 2026-08-15 — Fix publishing a release with a failed signed-URL upload

- `publishRelease.js` could mark a release `published` with a `file_path`
  pointing at a build that was never actually written to the `builds`
  storage bucket. The interactive "New Release" dialog uploads the build
  directly from the browser via a signed URL, then submits a separate
  request carrying only the resulting storage path — if that upload
  failed or was interrupted, the publish step still trusted the path and
  continued (the one place that touched storage afterward, a download
  for icon/metadata extraction, silently swallowed a missing-object error
  instead of aborting). Result: a live install link that 404s from
  Supabase Storage. Now a missing/failed object at that step hard-fails
  the publish with a "re-upload and try again" error instead of
  continuing. The direct-upload path (CI token endpoint) was never
  affected — it already checked the upload error before proceeding.

## 2026-08-12 — Organizations, OTP email verification, audit exports, white-label branding

- Email verification now supports an OTP code as an alternative to the
  confirmation link, at every send point (signup, resend, forgot
  password) — `supabase.auth.verifyOtp()` establishes a session directly
  on a correct code, no need to leave the page or wait for the email.
  Existing accounts that predate email verification get a one-time
  reverification prompt (OTP only) the next time they sign in, tracked
  independently of Supabase's own confirmation flag via
  `profiles.needs_reverification`.
- Switched Supabase Auth off its built-in email sender (a hard
  2-emails/hour-per-address cap) onto a custom SMTP relay, raising the
  configurable limit to 20/hour now that it's actually enforced.
- Added **organizations**: a grouping layer above projects for
  companies/teams, with email-keyed membership (`org_admin`/`member`
  roles, mirroring `project_collaborators`' shape), an optional seat
  limit enforced at the DB layer, and full owner-equivalent project
  access for org admins across every project under their org (no
  per-project collaborator row needed). Manage from `/organizations` in
  the main app; cross-tenant visibility and a seat-limit override live in
  admin's new `/organizations` section.
- Added org-level **compliance/audit export** — a CSV (or `?format=json`)
  of activity across every project in an organization, gated to org
  admins, streamed in batches rather than buffered in memory. Closed
  several gaps in the underlying per-project activity log: project
  creation, settings changes, API token create/revoke, and export events
  now all log to the same feed the Overview card and notification bell
  already read from.
- Added **white-label branding**: an organization can set a logo URL and
  accent color, shown on its projects' public install/share pages
  instead of the default QA Platform mark (v1 scope: light mode only, no
  custom domain).

## 2026-08-12 — Admin dashboard redesign, in-app update checks, repo restructuring

- Redesigned the admin app's navigation from a single overflowing top bar
  (10 tabs in one row, no mobile handling) into a collapsible left
  sidebar with grouped sections, an animated active-route indicator, a
  manual dark-mode toggle, and route-transition animations.
- Added an in-app "update available" API for apps distributed through
  this platform (`GET /api/v1/check-update`) — a running app sends its
  current version and gets back whether a newer build exists and a
  platform-appropriate install URL (iOS OTA manifest link, Android APK
  download, or the web URL). Documented at `/docs/api` with a
  client-integration example.
- Moved the main app's files into `main/`, mirroring `admin/`'s
  structure — the repo is now two symmetrical, independently-deployable
  app directories sharing `supabase/` at the root.
- Added `README.md`, `CLAUDE.md` (root + one per app), and this
  changelog, plus an in-app changelog page at `/changelog`.

## 2026-08-12 — Task collaboration, reminders, channel rollback, admin visibility

- Task comments (a discussion thread per task) with @mention detection
  that surfaces in the shared project activity feed.
- Task create/assign/complete/overdue events now log to the same
  activity feed as releases/collaborators/webhooks, so the Overview
  feed, notification bell, and CSV export all cover the board too.
- Automatic reminders: a release stuck in `pending_review` past 24h, or
  a task past its due date, nudges via webhook + best-effort email, once
  each.
- Release channels can now be pinned to a specific build (rollback) or
  promoted forward (internal → beta → production) instead of always
  resolving to "whatever's newest."
- Bulk collaborator invite (many emails, one role, one submit).
- Admin: cross-project webhook delivery monitor, API token management,
  an overdue-tasks view, per-project drill-down pages, and a Settings
  page for configurable thresholds (reminder timing, rate limits) and a
  DB-backed admin allowlist additive to the `ADMIN_EMAILS` env var.
- Fixed a real bug found along the way: `/api/cron/*` was never exempted
  from the session-auth middleware, so Vercel Cron (which carries no
  session cookie) was silently redirected to `/login` — the daily digest
  cron had never actually run in production.

## 2026-08-11 — Webhook reliability, admin audit log, rate limiting, task priority

- Fixed the admin Storage page's orphaned-file list to show the owning
  project + owner instead of a bare path.
- Webhook delivery log with retry; an admin action audit log; DB-backed
  rate limiting on the anonymous public endpoints (upload, report-issue,
  register-device); task priority + labels with board filter chips;
  cross-project "My tasks" view; admin global search; release
  comparison/diff (size delta + notes diff); opt-in daily email digests.

## 2026-08-11 — Admin panel

A fully separate app for platform-wide oversight — users, projects,
anonymous uploads (with moderation/bulk-delete), storage usage +
orphaned-file cleanup — gated by an `ADMIN_EMAILS` allowlist, talking to
the same Supabase project exclusively via the service-role client.

## 2026-08-11 — Release channels, staged rollout, AI features, public API

Release channels (internal/beta/production), staged rollout percentage,
scheduled releases, share-link expiry + PIN protection, an
owner-approval workflow for non-owner publishes, device registration for
iOS ad hoc provisioning, install-event analytics, AI-assisted
release-notes cleanup and tester-feedback triage (best-effort, no-op
without `ANTHROPIC_API_KEY`), and a Bearer-token-authenticated public
read API (`/api/v1/releases`) for CI integrations.

## 2026-08-11 — Notifications, CI tokens, board upgrades

Named profiles + avatar colors, a wider desktop layout, a command
palette, toast notifications, a project activity log, a notification
bell, project-scoped API tokens for CI publishing, task due
dates/assignees, drag-and-drop board reordering, search/filters, and
dashboard favorites.

## 2026-08-11 — Provisioning warnings, tester feedback, webhooks

Provisioning-profile expiry warnings for iOS releases, a tester-feedback
form that files straight onto the project board, install QR codes, and
outgoing release-published webhooks (Slack-compatible).

## 2026-08-10/11 — Collaboration & navigation

Project collaboration with Google-Drive-style roles (owner / editor /
commenter / viewer) and real RLS-backed access control; a public,
no-login upload landing page; a redesigned top navigation (floating
New Release / New Project dialogs, a per-project home page, Home button,
centered nav); OTP-based forgot-password and change-password flows.

## 2026-08-10 — Initial build

Projects, a kanban board, a changelog of releases per project, and OTA
distribution: iOS installs via `itms-services://` + a generated
`manifest.plist`, Android via direct signed-URL download, web via a
direct link. Redesigned the frontend from the initial scaffold into a
professional internal-dashboard look. Fixed iOS OTA installs for
Development-signed builds (auto-detects signing type and flags builds
that can't install OTA from a device that isn't registered).
