import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export function createClientBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// For postgres_changes subscriptions specifically: createClientBrowser()
// wires up auth for regular queries fine, but .channel().subscribe()
// opens its websocket immediately — if that happens before the client's
// own async getSession()-driven realtime.setAuth() call resolves, the
// socket connects as the anon role, so any RLS policy gating the
// subscription (e.g. is_platform_admin()) silently receives nothing, no
// error. Awaiting this before subscribing closes that race.
export async function createRealtimeClientBrowser() {
  const supabase = createClientBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) supabase.realtime.setAuth(session.access_token);
  return supabase;
}

// The admin panel talks to Supabase for its actual data ONLY via the
// service-role client — cross-tenant visibility requires bypassing RLS
// by design. Auth is handled entirely in middleware.js (session exists +
// email is in ADMIN_EMAILS), so pages can trust that gate and don't need
// their own RLS-respecting client.
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ADMIN_EMAILS (env var) union admin_allowlist (DB table, managed from
// admin/pages/settings.js) — either grants access. The env var is kept
// as a permanent "break-glass" fallback: a bad edit in the settings UI
// (e.g. removing the last DB-added admin) can never fully lock everyone
// out, since env-var admins are unaffected by the DB table.
export async function isAdminEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase();

  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(normalized)) return true;

  try {
    const service = createServiceClient();
    const { data } = await service.from("admin_allowlist").select("email").eq("email", normalized).maybeSingle();
    return !!data;
  } catch (e) {
    return false;
  }
}
