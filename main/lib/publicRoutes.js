// Single source of truth for which routes are reachable without a
// signed-in session — used by middleware.js (auth gating) and _app.js
// (PWA manifest/service-worker scoping), so the two stay in sync rather
// than drifting apart as two hand-maintained lists.

// "/" is the public upload landing page — anyone can drop a build there
// without signing in.
export function isPublicLandingPath(pathname) {
  return pathname === "/";
}

// Public, tester-facing pages reached via a shared link, not by signing
// in — not part of the internal team's app shell.
export function isPublicSharePath(pathname) {
  return (
    pathname.startsWith("/share/") ||
    pathname.startsWith("/channel/") ||
    pathname.startsWith("/register-device/") ||
    pathname.startsWith("/docs/")
  );
}

export function isAuthPath(pathname) {
  return pathname.startsWith("/login") || pathname.startsWith("/forgot-password");
}

// Reached only via the email link, which creates the session client-side
// after the page loads — kept separate from isAuthPath since middleware
// lets it through unconditionally, for both signed-in and anonymous
// visitors, rather than applying the login/forgot-password redirect rules.
export function isResetPasswordPath(pathname) {
  return pathname.startsWith("/reset-password");
}

// The PWA manifest/service-worker are scoped to pages only a signed-in
// user reaches — dashboard and everything behind it — not the public
// upload landing, the public tester-facing pages, or the pre-auth
// login/forgot-password/reset-password pages (installability is only
// ever offered once actually signed in).
export function isAppShellPath(pathname) {
  return (
    !isPublicLandingPath(pathname) &&
    !isPublicSharePath(pathname) &&
    !isAuthPath(pathname) &&
    !isResetPasswordPath(pathname)
  );
}
