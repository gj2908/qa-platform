# Changelog

Reverse-chronological summary of what's shipped, grouped by theme. See
`git log` for the literal commit history this is built from.

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
