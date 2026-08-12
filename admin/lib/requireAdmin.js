import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "./supabase";

// Defense-in-depth for API routes — middleware.js already gates page
// navigation, but a direct fetch() to an API route re-checks here too.
export async function requireAdmin(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }));
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isAdminEmail(user?.email))) return null;
  return user;
}
