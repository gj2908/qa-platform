// Derives the site origin from the incoming request itself (proto + host)
// rather than an env var, so a generated link always matches whatever
// domain actually served the request — the prod .com domain, a
// *.vercel.app deployment, or a preview URL — with nothing to configure.
export function getRequestOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${req.headers.host}`;
}
