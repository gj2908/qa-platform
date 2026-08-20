import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";

const VALID_STATUSES = ["pending", "connected", null];

// Manual override/fallback for marking a domain connection request
// fulfilled (or clearing it) — main/'s branding.js auto-provisions via
// the Vercel API when VERCEL_API_TOKEN/VERCEL_PROJECT_ID are set (see
// lib/vercelClient.js), and a daily cron + this page's "Check now"
// button (api/organizations/check-domain-status.js) recheck a pending
// domain automatically. This route stays as the last resort for when
// Vercel isn't configured, or a domain needs to be marked/cleared by
// hand for any other reason.
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

  const { orgId, domainStatus } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (!VALID_STATUSES.includes(domainStatus)) {
    res.status(400).json({ error: "domainStatus must be 'pending', 'connected', or null" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.from("organizations").update({ domain_status: domainStatus }).eq("id", orgId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "organization_domain_status_updated",
    targetType: "organization",
    targetId: orgId,
    detail: domainStatus || "cleared",
  });

  res.status(200).json({ ok: true });
}
