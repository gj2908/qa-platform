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

  const { userId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const service = createServiceClient();
  const { data: target } = await service.auth.admin.getUserById(userId);
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "user_deleted",
    targetType: "user",
    targetId: userId,
    detail: target?.user?.email || null,
  });

  res.status(200).json({ ok: true });
}
