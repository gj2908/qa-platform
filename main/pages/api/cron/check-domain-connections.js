import { createServiceClient } from "../../../lib/supabase/server";
import { isVercelConfigured, getProjectDomain, getDomainConfig } from "../../../lib/vercelClient";
import { logOrgActivity } from "../../../lib/logOrgActivity";

// Picks up where branding.js's immediate check left off — DNS
// propagation can take anywhere from seconds to hours, so a domain
// that came back 'pending' right after being requested gets rechecked
// here until it's actually connected. A no-op (not just skipped) when
// Vercel isn't configured, so this cron can stay enabled unconditionally.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isVercelConfigured()) {
    res.status(200).json({ ok: true, checked: 0, skipped: "Vercel not configured" });
    return;
  }

  const service = createServiceClient();
  const { data: pending } = await service
    .from("organizations")
    .select("id, domain")
    .eq("domain_status", "pending")
    .not("domain", "is", null);

  let connected = 0;
  for (const org of pending || []) {
    const domainRes = await getProjectDomain(org.domain);
    if (!domainRes.ok || !domainRes.verified) continue;

    const configRes = await getDomainConfig(org.domain);
    if (!configRes.ok || configRes.misconfigured) continue;

    await service.from("organizations").update({ domain_status: "connected" }).eq("id", org.id);
    await logOrgActivity(service, {
      orgId: org.id,
      actorEmail: "system",
      action: "org_domain_connected",
      detail: org.domain,
    });
    connected++;
  }

  res.status(200).json({ ok: true, checked: (pending || []).length, connected });
}
