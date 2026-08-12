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

  const { orgId } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  const service = createServiceClient();
  const { data: orgRow } = await service.from("organizations").select("name").eq("id", orgId).single();

  // projects.org_id is `on delete set null` — this only ungroups member
  // projects, never deletes them.
  const { error } = await service.from("organizations").delete().eq("id", orgId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "organization_deleted",
    targetType: "organization",
    targetId: orgId,
    detail: orgRow?.name || null,
  });

  res.status(200).json({ ok: true });
}
