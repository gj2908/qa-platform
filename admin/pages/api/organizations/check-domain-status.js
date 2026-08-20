import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";
import { isVercelConfigured, getProjectDomain, getDomainConfig } from "../../../lib/vercelClient";

// Operator-triggered on-demand check, for when you don't want to wait
// for main/'s daily check-domain-connections cron. Only ever moves a
// 'pending' domain to 'connected' automatically — never touches an
// already-connected or display-only domain, and never marks anything
// 'pending' itself (that's main/'s branding.js request flow).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const admin = await requireAdmin(req, res);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { orgId } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  if (!isVercelConfigured()) {
    res.status(400).json({ error: "Vercel isn't configured (VERCEL_API_TOKEN/VERCEL_PROJECT_ID) — mark it connected manually once you've verified DNS." });
    return;
  }

  const service = createServiceClient();
  const { data: org } = await service.from("organizations").select("domain, domain_status").eq("id", orgId).single();
  if (!org?.domain || org.domain_status !== "pending") {
    res.status(400).json({ error: "No pending domain request for this org" });
    return;
  }

  const domainRes = await getProjectDomain(org.domain);
  if (!domainRes.ok) {
    res.status(200).json({ ok: true, domainStatus: "pending", detail: domainRes.error || "Domain not found on the Vercel project yet" });
    return;
  }

  const configRes = domainRes.verified ? await getDomainConfig(org.domain) : { ok: true, misconfigured: true };
  const connected = domainRes.verified && configRes.ok && !configRes.misconfigured;

  if (connected) {
    await service.from("organizations").update({ domain_status: "connected" }).eq("id", orgId);
    await logAdminAction(service, {
      adminEmail: admin.email,
      action: "organization_domain_status_updated",
      targetType: "organization",
      targetId: orgId,
      detail: "connected (auto-checked)",
    });
  }

  res.status(200).json({ ok: true, domainStatus: connected ? "connected" : "pending" });
}
