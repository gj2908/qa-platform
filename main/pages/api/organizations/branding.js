import { createServerSupabase } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";
import { isVercelConfigured, addProjectDomain, getDomainConfig, removeProjectDomain } from "../../../lib/vercelClient";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { orgId, logoUrl, accentColor, domain, requestDomain } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (accentColor && !HEX_RE.test(accentColor)) {
    res.status(400).json({ error: "Accent color must be a hex code, e.g. #3358d4" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can update branding" });
    return;
  }

  const normalizedDomain = domain || null;

  // domain_status tracks the connect-a-real-domain flow (see
  // admin/'s manual fallback, used when VERCEL_API_TOKEN/VERCEL_PROJECT_ID
  // aren't set) — separate from just editing the display text. Editing
  // the domain text without requesting clears any prior status rather
  // than leaving a stale "connected" pointed at a value that's since
  // changed.
  const { data: currentOrg } = await authSupabase.from("organizations").select("domain, domain_status").eq("id", orgId).single();
  let domainStatus = currentOrg?.domain_status ?? null;
  let vercelError = null;

  if (requestDomain) {
    if (isVercelConfigured()) {
      // Auto-provisions the domain on Vercel's side immediately —
      // `main/pages/api/cron/check-domain-connections.js` picks it up
      // and flips this to 'connected' itself once DNS actually
      // resolves, no platform operator required. If DNS was already
      // set up ahead of time, this can go straight to 'connected'.
      const result = await addProjectDomain(normalizedDomain);
      if (!result.ok) {
        vercelError = result.error || "Couldn't provision this domain automatically.";
      } else {
        let connected = result.verified;
        if (connected) {
          const config = await getDomainConfig(normalizedDomain);
          connected = config.ok && !config.misconfigured;
        }
        domainStatus = connected ? "connected" : "pending";
      }
    } else {
      domainStatus = "pending";
    }
  } else if (normalizedDomain !== currentOrg?.domain) {
    domainStatus = null;
  }

  // Best-effort: stop paying for/holding a Vercel domain slot once the
  // org admin replaces or clears a domain that was actually requested.
  if (currentOrg?.domain && currentOrg.domain !== normalizedDomain && currentOrg.domain_status) {
    try {
      await removeProjectDomain(currentOrg.domain);
    } catch (e) {
      // ignored — never let Vercel cleanup block the real save
    }
  }

  const { error } = await authSupabase
    .from("organizations")
    .update({
      logo_url: logoUrl || null,
      accent_color: accentColor || null,
      domain: normalizedDomain,
      domain_status: domainStatus,
    })
    .eq("id", orgId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (requestDomain) {
    await logOrgActivity(authSupabase, {
      orgId,
      actorEmail: user.email,
      action: domainStatus === "connected" ? "org_domain_connected" : "org_domain_requested",
      detail: normalizedDomain,
    });
  } else {
    await logOrgActivity(authSupabase, {
      orgId,
      actorEmail: user.email,
      action: "org_branding_updated",
      detail: null,
    });
  }

  if (vercelError) {
    res.status(502).json({ error: vercelError });
    return;
  }

  res.status(200).json({ ok: true, domainStatus });
}
