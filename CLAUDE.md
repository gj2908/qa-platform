# CLAUDE.md

Repo-level orientation. For the details of a specific app, read that
app's own `CLAUDE.md` first — this file is just the map.

At the end of a work session that introduced a new table, cross-cutting
pattern, or gotcha, run the `update-claude-md` skill
(`.claude/skills/update-claude-md/SKILL.md`) to keep these three files
from drifting out of sync with the codebase.

## Shape of the repo

Two independent Next.js (Pages Router) apps, one shared Supabase project:

- `main/` — the product itself. See `main/CLAUDE.md`.
- `admin/` — a separate, cross-tenant admin panel for platform operators.
  See `admin/CLAUDE.md`.
- `supabase/` — migrations + `schema.sql`, shared by both apps. Lives at
  the repo root (not inside either app dir) because it's infrastructure
  for one database both apps talk to, owned by neither exclusively.

Each app has its own `package.json`, `node_modules`, `.env.local`, and
deploys as its own Vercel project — `cd main && vercel --prod` /
`cd admin && vercel --prod`. Never assume a single `npm install` at the
repo root covers both; there isn't a root `package.json`.

## Database workflow

Every schema change gets a timestamped file in `supabase/migrations/`,
applied via `supabase db push --linked`, then **manually mirrored into
`supabase/schema.sql`** in the same change — `schema.sql` is the
from-scratch reference doc (what you'd run in a brand-new Supabase
project), not something derived automatically from migrations. Both need
to stay in sync by hand.

RLS is the real enforcement layer, not a formality — `main/`'s
RLS-respecting client (`main/lib/supabase/server.js`'s
`createServerSupabase`) is what most of `main/`'s server code uses;
`admin/` bypasses RLS entirely on purpose via a service-role client,
since cross-tenant visibility is the whole point of that app. A handful
of tables (`admin_actions`, `rate_limit_events`, `platform_settings`,
`admin_allowlist`) have RLS enabled with **no policies at all** —
service-role-only by design, documented inline in `schema.sql` each time.

Auth email templates (signup confirmation, magic-link/reverification,
password recovery) are also shared infra at the root: `supabase/templates/
*.html`, wired via `[auth.email.template.*]` in `supabase/config.toml`,
pushed with `supabase config push --project-ref <ref>` (not `--linked` —
that form has been blocked before; always diff the push output, since it
replaces the *entire* remote auth config, not just the changed keys).

## Cross-app touchpoints

- `main/pages/api/v1/*` and `main/pages/api/ci/*` are Bearer-token
  (project-scoped `api_tokens`) — not session-cookie auth. `admin/` never
  calls into `main/`'s API; both just read/write the same Postgres
  database directly via their own Supabase clients.
- `main/middleware.js` gates every route behind a signed-in session
  except an explicit allowlist (public share/install pages, the
  no-login upload landing, the Bearer-token APIs, and `/api/cron/*` —
  Vercel Cron carries no session cookie, so that exemption is load-
  bearing, not optional; forgetting it silently breaks every cron job).
- `admin/middleware.js` gates on `ADMIN_EMAILS` (env var) **union**
  `admin_allowlist` (DB table) — the env var is a permanent break-glass
  fallback, never fully replaced by the DB table.
