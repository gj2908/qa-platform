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

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/forgot-password");
  const isPublicShare = req.nextUrl.pathname.startsWith("/share/");
  // "/" is the public upload landing page — anyone can drop a build there
  // without signing in (protected instead by requiring an email and, once
  // published, the release ID being an unguessable UUID).
  const isPublicLanding = req.nextUrl.pathname === "/";
  const isPublicUploadApi = req.nextUrl.pathname.startsWith("/api/public/");
  // CI/CD publishing is authenticated via its own Authorization: Bearer
  // <api token> header, not a session cookie — see pages/api/ci/releases/create.js.
  const isCiApi = req.nextUrl.pathname.startsWith("/api/ci/");
  // /reset-password is reached by clicking the email link, which creates the
  // session in the browser after the page loads — so anonymous visitors must
  // be allowed through and signed-in visitors must not be bounced away.
  const isResetPassword = req.nextUrl.pathname.startsWith("/reset-password");

  if (isPublicShare || isResetPassword || isPublicUploadApi || isCiApi) return res;

  if (isPublicLanding) {
    // Signed-in users have no need for the anonymous landing — send them
    // straight to their dashboard instead.
    if (user) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return res;
  }

  if (!user && !isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return res;
}

// NOTE: /api/manifest, /api/release-icon, /share/*, /api/public/*, and "/"
// itself are excluded from the login gate on purpose. /api/manifest and
// /api/release-icon are fetched directly by Apple's OS-level installer,
// which carries no browser auth cookies. /share/* is the public,
// anyone-with-the-link install page. "/" is the public upload landing, and
// /api/public/* is the endpoint it posts to — both meant to be reachable
// without signing in.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/manifest|api/release-icon|api/download|share/).*)",
  ],
};
