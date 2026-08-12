# CLAUDE.md — `main/`

The product: projects, collaborators, a kanban board, releases, and OTA
distribution. Next.js 14 Pages Router, plain JavaScript, Tailwind with
CSS-custom-property design tokens (see `styles/globals.css` /
`tailwind.config.js` — not stock Tailwind colors, this app has its own
`accent`/`success`/`warning`/`danger`/`ink-*`/`surface`/`border` token
set with light+dark values).

See the repo-root `CLAUDE.md` for the two-app/shared-database shape, and
`README.md` for setup.

`framer-motion` (same version as `admin/`) is used sparingly for minimal,
intentional animation — mount/unmount on the gate modals and dialogs
(`AnimatePresence` + `motion.div`, fade+scale, ~0.12–0.15s), a slide-in
on toasts, and a fade page transition in `_app.js` keyed on
`router.pathname`. Not used on data-heavy lists/tables (board, changelog)
— re-render animation there risks feeling janky against live data. Don't
reach for it as a default; most of the app still relies on Tailwind's
plain `transition-colors` for hover states, which is correct for those.

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
- **Organizations** (`organizations`/`org_members`) are an optional
  grouping layer above projects (`projects.org_id`, nullable — ungrouped
  projects work exactly as before). `org_role(p_org_id)` mirrors
  `project_role()`'s exact shape. Critically, `project_role()` itself is
  written to also grant `'owner'` when the caller is an `org_admin` of
  the project's org — this is *how* org-admins get full access to every
  project in their org without a direct `project_collaborators` row, and
  it means every existing/future RLS policy that calls `project_role()`
  picks up org-derived access automatically, with zero per-policy edits.
  If you ever need a second axis of "who can access this project," extend
  `project_role()` the same way rather than hand-editing policies.
- **`.insert(...).select()` can fail RLS even when the insert itself is
  allowed.** Confirmed live: chaining `.select()` onto an insert makes
  Postgres check the table's SELECT policy for the `RETURNING` clause —
  and if that policy depends on a row an `AFTER INSERT` trigger creates
  (e.g. `project_role()` depending on `assign_project_owner()`'s
  trigger-inserted `project_collaborators` row), the SELECT policy is
  evaluated *before* the trigger has run, so it fails even though a bare
  insert (no `.select()`) succeeds fine. Workaround used throughout
  (`NewProjectDialog.js`, `pages/api/organizations/create.js`): generate
  the row's `id` client-side (`crypto.randomUUID()`), insert without
  `.select()`, and use the already-known id — never chain `.select()`
  onto an insert into a table whose SELECT policy depends on a trigger
  that fires off that same insert.

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
- **Crash reporting has no automatic symbolication, by design.**
  `pages/api/public/crash-report.js` stores raw exception/stack-trace text
  and groups reports by a hash of `exceptionType + the stack trace's first
  line` — real dSYM/ProGuard-mapping symbolication (turning a raw memory
  address into a source file:line) isn't realistically buildable on
  Vercel's serverless runtime (no `atos`/`retrace` toolchain available).
  If you ever add real symbolication, it'll need an external service or a
  self-hosted worker, not a Vercel function.
- **Device/OS breakdown comes from `page_view_events`, not
  `install_events`.** `install_events`/`manifest.js`/`download.js` are hit
  by OS-level installer processes with unreliable User-Agent strings;
  `page_view_events` is written from `share/[id].js`'s actual page
  render, where a real browser UA is available. `lib/parseUserAgent.js`
  is a small dependency-free regex parser — good enough for a breakdown
  chart, not a general-purpose UA library.
- **"Latest release for project+channel+platform"** resolution
  (published+scheduled → lazily activate due-scheduled → filter
  published → latest per platform → overlay `channel_pins`, ignoring a
  pin whose release is no longer published) lives in
  `lib/resolveLatestRelease.js` — reused by `pages/channel/[projectId]/[channel].js`
  and `pages/api/v1/check-update.js`. Don't reimplement this a third time.
- **`main/CHANGELOG.md` is a copy, not a symlink, of the repo-root
  `CHANGELOG.md`.** `pages/changelog-log.js` reads the local copy at
  build time because Vercel's build sandbox for this subdirectory-rooted
  project doesn't expose files outside `main/`, even though the full
  repo is cloned (confirmed by a real deploy failure — `ENOENT` on
  `../CHANGELOG.md`). Update both files together when adding an entry.
- **OTP-code verification, one shared UI component, three separate email
  templates.** `components/ui/OtpCodeInput.js` (8-digit, matching
  `config.toml`'s `otp_length = 8`) is reused by every code-entry flow;
  each flow calls a *different* Supabase Auth send API so it gets its own
  dedicated email template/subject (never share a template across
  flows — a magic-link email that says "sign in" is wrong when it's
  actually for a password reset, learned the hard way this round):
  `signUp()`/`resend({type:"signup"})` → `confirmation` template →
  `verifyOtp({type:"signup"})`; `signInWithOtp({shouldCreateUser:false})`
  → `magic_link` template → `verifyOtp({type:"email"})` (existing-user
  one-time reverification only); `resetPasswordForEmail()` → `recovery`
  template → `verifyOtp({type:"recovery"})` (forgot password). Templates
  live in `supabase/templates/*.html`, wired via
  `[auth.email.template.*]` in `supabase/config.toml`.
- **A DB-backed gate needing its own network round-trip must render a
  blocking loading state, not `return null`, while unknown.** The two
  older gates (`VerifyEmailGate`, `CompleteProfileGate`) get their answer
  synchronously from the already-loaded session/JWT object.
  `ReverificationGate.js` is the first one needing an actual
  `profiles` row fetch after `user` resolves — during that fetch, if the
  gate returns `null` instead of a loading shell, a page refresh can
  briefly show real page content before the gate mounts. Any future gate
  with a real DB dependency needs the same three-state render (unknown →
  loading shell; false → nothing; true → the real gate).

## Testing changes

No permanent test suite — this codebase's established pattern (see
`CHANGELOG.md` for examples) is a disposable Playwright script written
to the repo root for the session, using the service-role client to
create/clean up its own test users/projects/data, run once, then
deleted. `npm install --no-save playwright` (never a permanent
dependency), always clean up even on failure.
