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

export function isAdminEmail(email) {
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowlist.includes(email.toLowerCase());
}
