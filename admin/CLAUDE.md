# CLAUDE.md — `admin/`

A fully separate Next.js app (own `package.json`, own deploy) for
platform operators — cross-project visibility the main app's per-project
RLS deliberately doesn't allow. Not tied to `project_collaborators` at
all; this is a platform-operator role, not a per-project one.

See the repo-root `CLAUDE.md` for the two-app/shared-database shape.

## Access control (two layers, same check)

`admin/lib/supabase.js`'s `isAdminEmail(email)` — now async — checks
`ADMIN_EMAILS` (env var, comma-separated) **union** the `admin_allowlist`
DB table (managed from `/settings`). The env var is a permanent
break-glass fallback: a bad edit in the settings UI (e.g. removing the
last DB-added admin) can never fully lock everyone out, since env-var
admins are unaffected by the DB table.

- `admin/middleware.js` — gates page navigation, calls `isAdminEmail`.
- `admin/lib/requireAdmin.js` — defense-in-depth for API routes (session
  cookie could reach an API route directly without going through
  middleware's page-level check).

Both need updating together if the auth model ever changes — don't patch
one without the other.

## Data access

Virtually everything reads/writes via `admin/lib/supabase.js`'s
`createServiceClient()` (service-role key, bypasses RLS by design — the
whole point of this app is seeing across every project). There is no
RLS-respecting client anywhere in `admin/`; trust is placed entirely in
the two auth checks above, not in the database layer.

## Patterns that repeat everywhere

- **Every destructive action logs to `admin_actions`** via
  `admin/lib/logAdminAction.js` (best-effort, wrapped so a logging
  failure never blocks the real delete/revoke/etc.) — new destructive
  routes should call it too, and the action string needs a label added
  to `pages/activity.js`'s `ACTION_LABEL` map.
- **Confirmations use `window.confirm()`**, not a styled dialog — a
  deliberate low-friction choice matching every existing delete/revoke
  button. If you script against these buttons (e.g. in a disposable
  Playwright test), remember the dialog listener must be registered
  *before* the click that triggers it, or Playwright auto-dismisses it
  and the action silently no-ops.
- **Configurable thresholds** (`platform_settings` table, edited from
  `/settings`) are read by `main/`'s code (`main/lib/platformSettings.js`'s
  `getSetting`), not by anything in `admin/` itself — this app is purely
  the editor UI for values `main/` consumes at request time, always with
  a hardcoded fallback if the row is missing.
- **Icon availability**: `lucide-react` here is pinned to an old `^1.31.0`
  (vs. the much newer version `main/` uses) — always grep
  `node_modules/lucide-react/dist/esm/icons/` before importing a new icon
  name here rather than assuming parity with `main/`'s icon set.
- **`/organizations`** gives cross-tenant visibility into `organizations`/
  `org_members` (member/project counts, a `seat_limit` override), same
  shape as `/projects`. Deleting an org here (`api/organizations/delete.js`)
  cascades to `org_members` — this used to be silently impossible (a
  trigger meant to stop removing an org's *last* org_admin also fired
  during that cascade, since every org always has ≥1 admin by design; the
  trigger now checks whether the `organizations` row itself is gone
  first). If a future guard trigger needs to protect an invariant on a
  row that can also be deleted via a parent's cascade, remember to add
  the same "is the parent already gone" escape hatch.
