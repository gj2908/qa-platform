# QA Platform

An internal QA/build-distribution tool: a kanban board, a changelog, and
OTA install pages for iOS/Android/web builds — plus a separate admin
panel for platform-wide oversight. Two Next.js apps, one shared Supabase
project (Postgres + Auth + Storage).

```
qa-platform/
├── main/       the product — projects, board, releases, distribution
├── admin/      a separate app for platform operators (cross-project visibility)
└── supabase/   migrations + schema.sql, shared by both apps
```

See [`main/CLAUDE.md`](main/CLAUDE.md) and [`admin/CLAUDE.md`](admin/CLAUDE.md)
for how each app is put together, and [`CHANGELOG.md`](CHANGELOG.md) for
what's shipped. `main/` also has an in-app changelog page at `/changelog`
sourced from the same file.

## What's in `main/`

- **Projects & collaborators** — Google-Drive-style roles (owner / editor
  / commenter / viewer), invite by email, ownership transfer, bulk invite.
- **Board** — kanban (backlog → todo → in progress → review → done),
  drag-and-drop, priority/labels, due dates, comments with @mentions,
  cross-project "My tasks" view.
- **Releases & distribution** — upload an `.ipa`/`.apk` or paste a web
  URL; iOS installs OTA via `itms-services://` + a generated
  `manifest.plist`, Android downloads the APK directly, web just opens
  the URL. Release channels (internal/beta/production) with pin-to-
  channel rollback and promote-to-next-channel. Staged rollout
  percentage, scheduled releases, share-link expiry/PIN, approval
  workflow for non-owner publishes.
- **Notifications** — a cross-project activity feed, a notification bell,
  outgoing webhooks (Slack-compatible) with a delivery log and retry,
  opt-in daily email digests, and automatic reminders when a release sits
  in review or a task passes its due date.
- **CI/API** — project-scoped Bearer tokens for non-interactive release
  publishing and read access; see `/docs/api` in the running app.
- **Public, no-login upload landing page** for quick "drop a build, get a
  link" sharing, rate-limited to prevent abuse.

## What's in `admin/`

A separate, ADMIN_EMAILS-gated app (or a DB-backed allowlist, additive to
the env var) with cross-tenant visibility via the Supabase service-role
client: users, projects, anonymous uploads, storage usage + orphaned-file
cleanup, webhook delivery monitoring, API token management, an overdue-
tasks view, an admin action audit log, and configurable platform
thresholds (reminder timing, rate limits).

## Setup

### 1. Supabase project

1. Create a project at supabase.com.
2. SQL editor → run `supabase/schema.sql` (or apply `supabase/migrations/`
   in order via `supabase db push --linked` if you're using the CLI).
3. Storage → New bucket → name it `builds` → **Private**.
4. Auth → Providers → Email enabled (this app uses email + password, not
   magic links).
5. Copy the Project URL, `anon` key, and `service_role` key from
   Settings → API.

### 2. Run locally

Each app is independent — install and run separately:

```bash
cd main && npm install && cp .env.example .env.local   # fill in your keys
npm run dev   # http://localhost:3000

cd admin && npm install   # create .env.local with the same 3 keys + ADMIN_EMAILS
npm run dev -- -p 3001    # http://localhost:3001
```

**`main/.env.local`**: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
optionally `NEXT_PUBLIC_SITE_URL` (used to build absolute links in
emails/webhooks), `RESEND_API_KEY` (email digests/reminders — degrades to
manual-send-only if unset), `ANTHROPIC_API_KEY` (AI release-notes
cleanup/feedback triage — no-ops if unset), `CRON_SECRET` (gates the
`/api/cron/*` routes in production).

**`admin/.env.local`**: the same 3 Supabase keys, plus `ADMIN_EMAILS`
(comma-separated allowlist — the permanent fallback, unioned with the
DB-backed allowlist manageable from the admin Settings page).

### 3. Deploy

Each app deploys from its own directory as its own Vercel project:

```bash
cd main && vercel --prod
cd admin && vercel --prod
```

Set the same env vars on each Vercel project (`vercel env add <NAME>
production`). `main/vercel.json` schedules the cron routes (daily digest,
approval/due-date reminders) — Vercel's Hobby plan only allows daily
cron schedules.

## Known limitations

- **No confirmed-install tracking** — install counts are "install
  clicks"/manifest fetches, not a verified OS-level install.
- **iOS ad hoc distribution** still requires the tester's device UDID to
  be registered in the provisioning profile (Apple's own constraint,
  not this app's) — Enterprise-signed builds skip it.
- **Staged rollout percentage** is cookie-bucketed for the web share
  page; it isn't applied to the in-app update-check API (`/api/v1/check-update`)
  yet, since a native app's HTTP client has no cookie to bucket by.
