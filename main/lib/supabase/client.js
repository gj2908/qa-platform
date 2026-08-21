import { createBrowserClient } from "@supabase/ssr";

const ONE_YEAR = 60 * 60 * 24 * 365;
const ONE_DAY = 60 * 60 * 24;

// `rememberMe` only matters at the login.js call site — every other
// createClient() call in the app passes no options and is unaffected.
// Since this app's browser client acts as a singleton (see
// useCurrentUser.js), the maxAge chosen at sign-in sticks as the cookie
// lifetime for that session; unchecking "remember me" shortens it to a
// day rather than promising an exact browser-close expiry, which
// @supabase/ssr 0.5.1 doesn't cleanly expose.
export function createClient({ rememberMe } = {}) {
  const options = {};
  if (rememberMe !== undefined) {
    options.cookieOptions = { maxAge: rememberMe ? ONE_YEAR : ONE_DAY };
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options
  );
}
