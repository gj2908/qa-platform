import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";

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

  const { orgId, seatLimit } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (seatLimit !== null && (!Number.isInteger(seatLimit) || seatLimit < 0)) {
    res.status(400).json({ error: "seatLimit must be a non-negative integer or null" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.from("organizations").update({ seat_limit: seatLimit }).eq("id", orgId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "organization_seat_limit_updated",
    targetType: "organization",
    targetId: orgId,
    detail: seatLimit === null ? "unlimited" : String(seatLimit),
  });

  res.status(200).json({ ok: true });
}
