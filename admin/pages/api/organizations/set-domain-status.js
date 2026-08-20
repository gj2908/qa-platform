import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";

const VALID_STATUSES = ["pending", "connected", null];

// Marks a domain connection request as fulfilled (or clears it) once a
// platform operator has manually run `vercel domains add` and confirmed
// DNS resolves — see main/'s DomainCard for the request side. No
// automatic Vercel provisioning happens anywhere in this app.
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
