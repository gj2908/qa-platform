# QA Platform

Planning (kanban) + changelog + QA distribution, in one Next.js app on
Vercel, backed by Supabase (Postgres + Auth + Storage).

## What it does

- **Board** (`/projects/[id]/board`) — kanban with backlog → todo →
  in progress → review → done.
- **Changelog** (`/projects/[id]/changelog`) — list of published releases
  with notes, per project.
- **New release** (`/projects/[id]/new-release`) — upload an `.ipa`/`.apk`,
  or paste a web app URL, plus version + release notes.
- **Distribute** (`/distribute/[releaseId]`) — the install page:
  - **iOS**: tapping "Install" triggers OTA install directly via
    `itms-services://`, backed by an on-the-fly `manifest.plist`
    (`/api/manifest`) pointing at a signed, short-lived Supabase Storage URL.
  - **Android**: "Install" downloads the APK directly (signed URL, 1 hour
    expiry) — the OS handles the actual install/sideload from there.
  - **Web**: "Open app" just links straight to the app's URL.
  - Release notes are shown on the same page.
- Everything is gated behind Supabase Auth (magic-link email login) via
  `middleware.js` — **except** `/api/manifest`, which has to stay reachable
  without a browser session because Apple's OS-level installer fetches it
  directly, not through a logged-in browser. It's protected instead by the
  release ID being an unguessable UUID and the underlying file URL expiring
  in 5 minutes.

## Setup

### 1. Supabase project

1. Create a project at supabase.com.
2. SQL editor → run `supabase/schema.sql`.
3. Storage → New bucket → name it `builds` → **Private**.
4. Auth → Providers → make sure Email (magic link) is enabled. Auth → URL
   Configuration → add your Vercel domain as a redirect URL.
5. Copy the Project URL, `anon` key, and `service_role` key from
   Settings → API.

### 2. Deploy to Vercel

- Import this repo.
- Set env vars (see `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Deploy.

### 3. Use it

- Visit the site → sign in with your email (magic link) → any email can
  sign in and use it, since it's an internal tool with no invite list yet.
- Create a project → add tasks to the board → create a release (upload
  build or paste a web URL + notes) → share the `/distribute/...` link
  with testers, who'll need to sign in too.

## Known limitations / next steps

- **No invite list** — right now any email can sign up via magic link.
  If you need to restrict who can join, add an `allowed_emails` table and
  check it in the login flow, or disable public sign-ups in Supabase Auth
  settings and invite users manually from the dashboard.
- **iOS UDID requirement** — Apple's ad hoc distribution rule still
  applies: the tester's device UDID must already be registered in the
  app's provisioning profile. Enterprise-signed builds skip this.
- **File size** — `formidable` is capped at 500MB in `api/releases/create.js`;
  raise `maxFileSize` if needed, and check your Vercel plan's function
  payload/duration limits for very large uploads.
- **Task ordering/drag-and-drop** — the board currently moves tasks between
  columns with ←/→ buttons rather than drag-and-drop, to keep the
  dependency list small. Swapping in `@dnd-kit` later is a small change.
- **RLS is wide open to any signed-in user** for simplicity. If you need
  per-project permissions later, add a `project_members` table and tighten
  the policies in `schema.sql`.
