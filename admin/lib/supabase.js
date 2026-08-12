import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export function createClientBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
