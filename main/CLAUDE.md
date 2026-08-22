# CLAUDE.md — `main/`

The product: projects, collaborators, a kanban board, releases, and OTA
distribution. Next.js 14 Pages Router, plain JavaScript, Tailwind with
CSS-custom-property design tokens (see `styles/globals.css` /
`tailwind.config.js` — not stock Tailwind colors, this app has its own
`accent`/`success`/`warning`/`danger`/`ink-*`/`surface`/`border` token
set with light+dark values). `accent` is an indigo-violet brand color
(`#4f46e5` light / `#8b85f5` dark) — three font roles exist:
`font-sans` (Inter, everywhere), `font-display` (Space Grotesk, landing-
page headlines only), and `font-mono` (JetBrains Mono, version/build
numbers and stat numerals — see `components/ui/VersionTag.js`).

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

- **Radix primitives live in `components/shadcn/*.jsx`, hand-ported —
  the `shadcn` CLI does not work in this repo.** `npx shadcn@latest
  init`'s framework detection looks for a Next.js **App Router**
  directory literally named `app/` (Next 13+'s `app/layout.js` +
  `app/page.js` convention) — unrelated to this repo's own `main/`
  vs `admin/` split. This project has neither an `app/` router dir nor
  a root-level `app/` anything; `main/` is 100% Pages Router
  (`main/pages/*.js`), so the CLI exits with "could not detect a
  supported framework" every time. So `dialog.jsx`, `dropdown-menu.jsx`,
  `sheet.jsx`, `tooltip.jsx`, `popover.jsx`, `separator.jsx`, and
  `table.jsx` were hand-copied from the public registry
  (`https://ui.shadcn.com/r/styles/new-york/<name>.json`), stripped of
  TypeScript, and rewired to use this app's **real** token classes
  (`bg-surface`, `text-ink-primary`, `border-border`, etc.) directly —
  not shadcn's own `bg-background`/`bg-primary`/`bg-muted` alias
  convention. This matters because shadcn's generic "accent" role means
  a neutral hover/highlight surface, while this app's `accent` Tailwind
  key already means the brand indigo — reusing shadcn's alias names
  would silently collide the two meanings. If you add another primitive
  from the registry, follow the same recipe (fetch the JSON, convert to
  `.jsx`, swap every generic shadcn class for the equivalent real token
  class) rather than trying to get the CLI to run. `components/ui/*.js`
  (the original hand-rolled primitives — `Button`, `Card`, `Badge`,
  `EmptyState`, etc.) are untouched and still the first choice for
  anything that doesn't need Radix's focus-trap/portal/keyboard-nav
  behavior; reach for `components/shadcn/*` only for dialogs, dropdown
  menus, the mobile nav sheet, and tooltips, where that behavior is the
  actual point. `lib/utils.js`'s `cn()` (clsx + tailwind-merge) exists
  only to support these files — everything else in the app composes
  Tailwind classes with plain template strings. `jsconfig.json`'s `@/*`
  alias exists only so these ported files' `@/lib/utils` import matches
  the registry source verbatim.

- **`ProjectShell` now has a persistent, collapsible left sidebar
  (`components/layout/ProjectSidebar.js`) instead of a horizontal tab
  bar** — `AppShell` still has no sidebar at all (dashboard/account pages
  have no tab set), so "no sidebar anywhere" is no longer an app-wide
  claim, only an `AppShell` one. Tab visibility (including the owner-only
  "Settings" entry) is decided exactly once, in `ProjectShell.js`, by
  filtering its static `TABS` array with `isOwner(role)`
  (`components/ui/role.js`) — the resulting list feeds both
  `ProjectSidebar` (desktop, `sm:` and up) and `TopNav`'s mobile Sheet
  drawer, so neither has its own role logic. Every page that renders
  `<ProjectShell>` must pass `role` (it already fetches it via the same
  `project_role` RPC every other page uses) or the Settings tab silently
  never appears. `NavTab.js` is a single style used identically in both
  contexts (no more responsive dual-mode branching) — collapsed-sidebar
  icons wrap it in `components/shadcn/tooltip.jsx`'s `Tooltip` via
  `asChild`, which is why `NavTab` is wrapped in `forwardRef` (a plain
  function component would silently drop Radix's ref and break
  positioning). Sidebar collapse state is one global `localStorage`
  boolean (`qa-platform-sidebar-collapsed`), same lazy-init-from-
  localStorage shape as `lib/theme.js`'s theme preference.

- **Settings live on a dedicated page at each level, not wherever a
  feature happened to be built.** Project-level owner-only settings
  (approval requirement, roadmap, webhook, digest, release emails, org
  assignment, legal hold, registered devices, API tokens) are on
  `pages/projects/[id]/settings.js`, gated server-side the same way
  `organizations/[id]/settings.js` already gated on `org_role`:
  `getServerSideProps` returns `notFound` when `role !== "owner"`.
  `pages/projects/[id]/index.js` (Overview) only renders actual overview
  content now; `pages/projects/[id]/collaborators.js` only renders
  people/roles/activity — devices and API tokens moved out of it onto
  the new Settings page, since they're a distribution/developer concern,
  not a people one. All three settings surfaces (project, org, account —
  `pages/settings.js`) group their cards with the new
  `components/ui/SettingsSection.js` (label + description + a grid of
  children, `columns={2}` for cards that are just a toggle) instead of
  one flat stack — reach for it for any new settings card rather than
  appending another bare `<Card>` to a growing list.
- **`components/ui/Switch.js`** (a real `role="switch"` toggle) replaces
  the old pattern of relabeling a primary/secondary `Button` as "On"/
  "Off" for a boolean setting — every settings toggle in the app now
  uses it (project/org/account settings, feature flags). Its `onChange`
  receives the next boolean directly (not the previous value negated),
  so handlers don't need to compute `!current` themselves.

- **Building a domain-correct absolute URL server-side: use
  `lib/getRequestOrigin.js`'s `getRequestOrigin(req)`** (proto +
  `req.headers.host`), not `process.env.NEXT_PUBLIC_SITE_URL`. It's
  unset by default (absent from `.env.example`), so anything reading it
  directly with no fallback silently produces a broken/empty-origin
  link on any deploy that didn't set it — a real gap in
  `lib/buildDigest.js` and the `pages/api/cron/*` reminder emails as of
  this writing. `getRequestOrigin` sidesteps the env var entirely and
  always matches whatever domain actually served the request (prod
  `.com` domain, a connected org domain, or `*.vercel.app`), the same
  way `pages/api/organizations/members/add.js`'s invite-signup link and
  `pages/organizations/[id]/settings.js`'s invite-link card already do.
  Client components needing the same thing just read
  `window.location.origin` directly (see `pages/distribute/[id].js`'s
  release share link) — no helper needed there since it's already
  request-accurate by definition.
- **An unguessable token can stand in for an RLS role check when the
  caller doesn't have one yet.** `pages/api/organizations/join.js`
  (self-serve org invite links, `organizations.invite_token`) reads and
  writes through the service-role client specifically because the
  visitor isn't an org member yet, so `org_role()`-backed policies can't
  authorize them — possession of the token *is* the authorization,
  mirroring `/share/[id].js`'s unguessable release id. Reach for this
  shape (service client + token-as-capability) instead of a real RLS
  policy whenever the actor legitimately has no row-level identity yet.
- **Best-effort, never block the real mutation.** Webhook sends
  (`lib/webhookNotify.js`), activity logging (`lib/logActivity.js`),
  email (`lib/emailClient.js`), AI calls (`lib/aiClient.js`) are all
  wrapped in try/catch that swallows errors, so a release publish/task
  update/etc. never fails because a secondary side-effect did. Follow
  this shape for any new notification/logging/integration code.
  `webhookNotify.js` also branches payload *shape* by the target URL's
  host (Slack-style `{text}` normally, a MessageCard for anything on
  `office.com`/`office365.com`/`logic.azure.com`) — a single
  `webhook_url` field still works for either provider with zero extra
  config; add another provider here the same way rather than a new field.
- **Optional external providers degrade to no-ops.** `ANTHROPIC_API_KEY`,
  `RESEND_API_KEY`, and `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` being unset
  doesn't break anything — the relevant functions just return
  `{ ok: false }` (or `{ ok: false, skipped: true }` for
  `lib/vercelClient.js`) and callers already handle that. Don't add hard
  failures if one of these keys is missing.
- **Automatic domain provisioning**: requesting a domain connection
  (`pages/api/organizations/branding.js`, `requestDomain: true`) calls
  the Vercel REST API (`lib/vercelClient.js`) to add the domain to this
  project directly, rather than requiring a platform operator to run
  `vercel domains add` by hand. `pages/api/cron/check-domain-connections.js`
  (daily — matches this app's other crons' cadence) rechecks every
  `domain_status = 'pending'` org until Vercel reports both `verified`
  (ownership — only actually contested if the domain's already attached
  elsewhere on Vercel) and not `misconfigured` (the org's own DNS
  actually resolving to Vercel), then flips it to `'connected'` and logs
  `org_domain_connected`. When `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID`
  aren't set, this silently falls back to the original manual flow:
  `domain_status` just goes straight to `'pending'` and a platform
  operator fulfills it from `admin/`'s org detail page (which also has
  its own on-demand "Check now" button, `admin/pages/api/organizations/
  check-domain-status.js`, duplicating a small piece of the same Vercel
  client rather than importing across apps — see repo-root CLAUDE.md on
  why the two apps never share code directly).
- **`project_activity` is the shared activity log** behind the Overview
  feed, the notification bell, and the CSV export — all three read it
  generically, so a new event type only needs an `ACTIVITY_META` entry
  in `lib/activityMeta.js`, not changes to all three consumers.
- **A task can be assigned to one person or the whole project team, never
  both.** `tasks.assigned_to_team` (boolean) sits alongside the older
  `assignee_email` column — the two are mutually exclusive by
  application convention, not a DB constraint (`TaskDetailDialog.js`'s
  `save()` and `board.js`'s `saveTaskDetails`/`bulkSetAssignee` clear one
  whenever they set the other). Every place that used to treat
  `assignee_email` as "is this task mine" now also has to check
  `assigned_to_team` — `pages/my-tasks.js` and
  `pages/api/account/export-data.js` do this with a single `.or()`
  filter (safe because RLS already scopes `tasks` to the caller's own
  projects, so "team-assigned" collapses to "any project I'm on");
  `pages/api/cron/task-due-check.js` runs via the service client
  (RLS-bypassing), so it resolves `project_collaborators` explicitly
  instead. `admin/pages/tasks.js` and `TaskCard.js` just render "Whole
  team" in place of a single assignee. Assigning to the team fans out
  one email+push batch via `pages/api/tasks/notify-team-assign.js`
  (re-validates project membership server-side, same posture as
  `notify-mention.js`) but logs a single `task_assigned_team`
  `project_activity` row, not one per collaborator — the activity feed
  is already shared/visible to the whole project from one row.
- **`components/ui/ExpandableList.js`** is the shared "show 5, then see
  more" list pattern — extracted from the org dashboard's original
  inline `useState`+`.slice()` toggle. Reused by the org dashboard, the
  project Overview activity card, and the Collaborators page's member
  list and activity log. Takes `items` + a `renderItem` render-prop (no
  assumed item shape) so call sites with different row markup can all
  share the same toggle behavior — reach for this instead of
  reimplementing a local `showAll` state for any new capped list.
- **`lib/hooks/useNotifications.js`** is the shared data layer behind
  both `NotificationBell.js` (dropdown) and `pages/notifications.js`
  (full history) — they used to duplicate the fetch/dismiss/clear-all
  logic byte-for-byte. The one thing the hook deliberately does *not*
  own is *when* to mark notifications read, since that differs by
  surface (bell: on open, full page: on load) — it only exposes
  `markRead()`, and each caller decides the trigger.
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
- **Every file the PWA install pipeline touches must resolve to a 200
  for an anonymous, cookie-less request** — `manifest.json`, `sw.js`,
  `icons/*`, and the manifest's `start_url` (`"/"`, the public upload
  landing, redirected to `/dashboard` server-side for signed-in visitors
  by `middleware.js` — not `/dashboard` itself). Confirmed live on
  Android: Chrome's real "Install app" flow (the one producing a true
  standalone WebAPK, not just a home-screen shortcut) has Google's
  WebAPK-minting server independently re-fetch all of these with no
  session cookie, to build the package. `middleware.js`'s matcher
  originally only excluded `favicon.ico` (a file that doesn't even exist
  — see `_app.js`'s actual `favicon-32.png`) from the login gate, not
  `manifest.json`/`sw.js`/`icons/*`, so every one of those anonymous
  fetches was hitting the `/login` redirect — confirmed by `curl`
  against prod returning a 307 to `/login` for `/manifest.json` and
  `/icons/icon-192.png`. The mint silently fails in that state and
  Chrome falls back to a plain shortcut that opens in a normal browser
  tab instead of standalone, with no error surfaced anywhere
  client-side. `beforeinstallprompt` firing and the browser's own menu
  offering "Install app" both still look fine — the browser tab's own
  fetches of these files are cookie-authenticated, so only the
  cookie-less server-side mint fails — which makes this easy to miss;
  the only symptom is the installed icon not actually behaving like a
  standalone app. Any new static asset the manifest references (new
  icon sizes, screenshots, etc.) needs the same exemption in
  `middleware.js`'s matcher, or this regresses silently again.
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
  The stable 0-99 device bucketing it uses for staged rollout is its own
  small utility, `lib/deviceBucket.js`'s `bucketForDeviceId()` — reused
  as-is (not reimplemented) by `pages/api/v1/feature-flags.js` for
  percentage-rollout feature flags, so the same device consistently
  lands on the same side of both a release rollout and a flag.
- **`main/CHANGELOG.md` is a copy, not a symlink, of the repo-root
  `CHANGELOG.md`.** `pages/changelog-log.js` reads the local copy at
  build time because Vercel's build sandbox for this subdirectory-rooted
  project doesn't expose files outside `main/`, even though the full
  repo is cloned (confirmed by a real deploy failure — `ENOENT` on
  `../CHANGELOG.md`). Update both files together when adding an entry.
- **OTP-code verification, one shared UI component, two separate email
  templates.** `components/ui/OtpCodeInput.js` (8-digit, matching
  `config.toml`'s `otp_length = 8`) is reused by every code-entry flow;
  each flow calls a *different* Supabase Auth send API so it gets its own
  dedicated email template/subject (never share a template across
  flows): `signUp()`/`resend({type:"signup"})` → `confirmation` template
  → `verifyOtp({type:"signup"})`; `resetPasswordForEmail()` → `recovery`
  template → `verifyOtp({type:"recovery"})` (forgot password). Templates
  live in `supabase/templates/*.html`, wired via
  `[auth.email.template.*]` in `supabase/config.toml`. Sign-in itself is
  email+password only (`signInWithPassword`) — there's no magic-link
  sign-in anywhere in this app.
- **Gates render a blocking loading state, not `return null`, while
  their answer is unknown.** `VerifyEmailGate`/`CompleteProfileGate` get
  their answer synchronously from the already-loaded session/JWT object,
  so this rarely matters for them in practice — but any future gate
  needing its own DB round-trip (there used to be one,
  `ReverificationGate.js`, a one-time legacy-account reverification
  check via `signInWithOtp()`/the `magic_link` template — removed once
  every account had been reverified and it was adding a network round
  trip + loading flash on every hard refresh for zero remaining benefit)
  must use the same three-state render (unknown → loading shell; false →
  nothing; true → the real gate) or a page refresh can briefly show real
  content before the gate mounts. `RequireMfaGate` is the first real
  example of this — it does its own `org_members`/`organizations` +
  `auth.mfa.listFactors()` lookup. It also has to special-case its own
  escape hatch: it never blocks `/settings` itself (checked via
  `useRouter().pathname`), since that's the only page with the actual
  TOTP-enrollment UI (`TwoFactorCard`) — a gate whose fix lives on one
  specific page always needs that page exempted, or a required-but-
  unenrolled user could never reach the thing that satisfies the gate.

## Testing changes

No permanent test suite — this codebase's established pattern (see
`CHANGELOG.md` for examples) is a disposable Playwright script written
to the repo root for the session, using the service-role client to
create/clean up its own test users/projects/data, run once, then
deleted. `npm install --no-save playwright` (never a permanent
dependency), always clean up even on failure.
