// Thin Vercel REST API client for automatic custom-domain provisioning,
// mirroring lib/aiClient.js's "optional external provider, no-op when
// unconfigured" shape. VERCEL_API_TOKEN/VERCEL_PROJECT_ID unset means
// every call below returns { ok: false, skipped: true } and callers
// fall back to the pre-existing manual admin/ fulfillment flow — this
// app must keep working with none of this configured.
const FETCH_TIMEOUT_MS = 10_000;
const API_BASE = "https://api.vercel.com";

export function isVercelConfigured() {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function withTeam(path) {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}` : path;
}

async function vercelFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${withTeam(path)}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || `Vercel API error (${res.status})` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

// Adds a domain to the app's Vercel project. If it's already attached
// (a re-request after a prior success, or a race with the cron check),
// falls back to fetching its existing state instead of surfacing
// Vercel's "already exists" 400 as an error to the org admin.
export async function addProjectDomain(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };

  const added = await vercelFetch(`/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (added.ok) return { ok: true, verified: added.data.verified, verification: added.data.verification || [] };

  const existing = await getProjectDomain(domain);
  if (existing.ok) return existing;

  return { ok: false, error: added.error };
}

export async function getProjectDomain(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };
  const res = await vercelFetch(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`);
  if (!res.ok) return res;
  return { ok: true, verified: res.data.verified, verification: res.data.verification || [] };
}

// Separate from verified above — verified proves *ownership* (only
// contested when the domain's already attached elsewhere on Vercel);
// misconfigured proves the org's own DNS actually points at Vercel yet.
// Both must be good before we call the domain "connected".
export async function getDomainConfig(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };
  const res = await vercelFetch(`/v6/domains/${encodeURIComponent(domain)}/config`);
  if (!res.ok) return res;
  return { ok: true, misconfigured: res.data.misconfigured };
}

export async function removeProjectDomain(domain) {
  if (!isVercelConfigured()) return { ok: false, skipped: true };
  return vercelFetch(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
}
