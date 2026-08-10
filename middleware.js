import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isPublicShare = req.nextUrl.pathname.startsWith("/share/");

  if (isPublicShare) return res;

  if (!user && !isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

// NOTE: /api/manifest and /share/* are excluded from the login gate on
// purpose. /api/manifest is fetched directly by Apple's OS-level installer,
// which carries no browser auth cookies. /share/* is the public,
// anyone-with-the-link install page — it's meant to be reachable without
// signing in (protected instead by the release ID being an unguessable
// UUID and, for iOS, the underlying file URL expiring after 5 minutes).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/manifest|share/).*)"],
};
