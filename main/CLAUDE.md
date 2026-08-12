# CLAUDE.md — `main/`

The product: projects, collaborators, a kanban board, releases, and OTA
distribution. Next.js 14 Pages Router, plain JavaScript, Tailwind with
CSS-custom-property design tokens (see `styles/globals.css` /
`tailwind.config.js` — not stock Tailwind colors, this app has its own
`accent`/`success`/`warning`/`danger`/`ink-*`/`surface`/`border` token
set with light+dark values).

See the repo-root `CLAUDE.md` for the two-app/shared-database shape, and
`README.md` for setup.

## Auth & data access

- `lib/supabase/client.js`'s `createClient()` — browser, RLS-respecting.
  Most board/task mutations write directly from client components with
  this (no dedicated `pages/api/tasks/*` routes exist — deliberate, RLS
  is trusted to enforce who can write what).
- `lib/supabase/server.js`'s `createServerSupabase(req, res)` — server,
  RLS-respecting (used in `getServerSideProps` and most API routes).
- `lib/supabase/server.js`'s `createServiceClient()` — bypasses RLS.
  Only ever used **after** an explicit permission check in the calling
  code (e.g. confirming `project_role() === 'owner'` before using it to
  do the actual write) — never as a shortcut around RLS.
- `project_role(p_project_id)` (Postgres function, `security definer`) is
  the RLS building block almost every policy calls — it looks up the
  caller's role in `project_collaborators` without recursing into that
  table's own RLS. Roles are Google-Drive-style: `viewer` < `commenter`
  < `editor` < `owner` (see `components/ui/role.js`'s helpers).

## Patterns that repeat everywhere

- **Best-effort, never block the real mutation.** Webhook sends
  (`lib/webhookNotify.js`), activity logging (`lib/logActivity.js`),
  email (`lib/emailClient.js`), AI calls (`lib/aiClient.js`) are all
  wrapped in try/catch that swallows errors, so a release publish/task
  update/etc. never fails because a secondary side-effect did. Follow
  this shape for any new notification/logging/integration code.
- **Optional external providers degrade to no-ops.** `ANTHROPIC_API_KEY`
  and `RESEND_API_KEY` being unset doesn't break anything — the relevant
  functions just return `{ ok: false }` and callers already handle that.
  Don't add hard failures if one of these keys is missing.
- **`project_activity` is the shared activity log** behind the Overview
  feed, the notification bell, and the CSV export — all three read it
  generically, so a new event type only needs an `ACTIVITY_META` entry
  in `lib/activityMeta.js`, not changes to all three consumers.
- **Cron routes** (`pages/api/cron/*.js`) are gated by a `CRON_SECRET`
  bearer header (soft-gated — if the env var isn't set, the check is
  skipped, matching this app's "degrade gracefully" pattern elsewhere)
  and must be listed in `middleware.js`'s `isCronApi` exemption, or
  Vercel Cron's cookie-less request gets redirected to `/login` and the
  job silently never runs (this exact bug shipped once already — see
  `CHANGELOG.md`).
- **"Latest release for project+channel+platform"** resolution
  (published+scheduled → lazily activate due-scheduled → filter
  published → latest per platform → overlay `channel_pins`, ignoring a
  pin whose release is no longer published) lives in
  `lib/resolveLatestRelease.js` — reused by `pages/channel/[projectId]/[channel].js`
  and `pages/api/v1/check-update.js`. Don't reimplement this a third time.

## Testing changes

No permanent test suite — this codebase's established pattern (see
`CHANGELOG.md` for examples) is a disposable Playwright script written
to the repo root for the session, using the service-role client to
create/clean up its own test users/projects/data, run once, then
deleted. `npm install --no-save playwright` (never a permanent
dependency), always clean up even on failure.
