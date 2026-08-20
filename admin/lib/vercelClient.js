// Same Vercel REST API wrapper as main/lib/vercelClient.js — duplicated
// rather than shared because admin/ and main/ are fully separate apps
// (own package.json, own env vars, own deploy; see repo-root CLAUDE.md).
// Used for the operator-triggered "Check now" button on an org's domain
// connection; main/'s copy handles the org-admin-facing request flow and
// the daily cron recheck.
const FETCH_TIMEOUT_MS = 10_000;
const API_BASE = "https://api.vercel.com";

export function isVercelConfigured() {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function withTeam(path) {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}` : path;
}

async function vercelFetch(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${withTeam(path)}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `Vercel API error (${res.status})` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getProjectDomain(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };
  const res = await vercelFetch(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`);
  if (!res.ok) return res;
  return { ok: true, verified: res.data.verified };
}

export async function getDomainConfig(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };
  const res = await vercelFetch(`/v6/domains/${encodeURIComponent(domain)}/config`);
  if (!res.ok) return res;
  return { ok: true, misconfigured: res.data.misconfigured };
}
