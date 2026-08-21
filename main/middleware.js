import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicLandingPath, isPublicSharePath, isAuthPath, isResetPasswordPath } from "./lib/publicRoutes";

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

  const isAuthPage = isAuthPath(req.nextUrl.pathname);
  const isPublicShare = isPublicSharePath(req.nextUrl.pathname);
  // "/" is the public upload landing page — anyone can drop a build there
  // without signing in (protected instead by requiring an email and, once
  // published, the release ID being an unguessable UUID).
  const isPublicLanding = isPublicLandingPath(req.nextUrl.pathname);
  const isPublicUploadApi = req.nextUrl.pathname.startsWith("/api/public/");
  // CI/CD publishing is authenticated via its own Authorization: Bearer
  // <api token> header, not a session cookie — see pages/api/ci/releases/create.js.
  const isCiApi = req.nextUrl.pathname.startsWith("/api/ci/");
  // The public read API is also Bearer-token authenticated, not cookie-
  // based — see pages/api/v1/releases/*.
  const isPublicV1Api = req.nextUrl.pathname.startsWith("/api/v1/");
  // Cron routes are invoked by Vercel Cron with a CRON_SECRET bearer
  // header, not a session cookie — see pages/api/cron/*.
  const isCronApi = req.nextUrl.pathname.startsWith("/api/cron/");
  // /reset-password is reached by clicking the email link, which creates the
  // session in the browser after the page loads — so anonymous visitors must
  // be allowed through and signed-in visitors must not be bounced away.
  const isResetPassword = isResetPasswordPath(req.nextUrl.pathname);

  if (isPublicShare || isResetPassword || isPublicUploadApi || isCiApi || isPublicV1Api || isCronApi) return res;

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

// NOTE: /api/manifest, /api/release-icon, /share/*, /api/public/*, "/",
// /api/cron/*, manifest.json, sw.js, and icons/* are excluded from the
// login gate on purpose. /api/manifest and /api/release-icon are fetched
// directly by Apple's OS-level installer, which carries no browser auth
// cookies. /share/* is the public, anyone-with-the-link install page. "/"
// is the public upload landing, and /api/public/* is the endpoint it
// posts to — both meant to be reachable without signing in. /api/cron/*
// is invoked by Vercel Cron itself, which has no session cookie either.
// manifest.json/sw.js/icons/* must stay reachable anonymously too — found
// live: Chrome's WebAPK-minting service re-fetches all three with no
// session cookie to build a real standalone Android install, and having
// them redirect to /login here made every Android "Install" silently
// fall back to a plain home-screen shortcut instead (see main/CLAUDE.md).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|api/manifest|api/release-icon|api/download|share/).*)",
  ],
};
