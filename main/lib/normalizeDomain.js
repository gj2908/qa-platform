// Strips a protocol prefix, any path, and trailing slashes from a
// user-entered domain so it's always stored/used as a bare hostname
// (e.g. "mpebbles.vercel.app") — both the Vercel domain API
// (lib/vercelClient.js) and any `https://${domain}` URL-building assume
// this, and nothing previously stopped someone pasting a full URL into
// the domain field instead of just the hostname.
export function normalizeDomain(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const host = trimmed.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  return host || null;
}
