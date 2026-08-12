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

  const { path } = req.body || {};
  if (!path) {
    res.status(400).json({ error: "Missing path" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.storage.from("builds").remove([path]);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "orphan_file_removed",
    targetType: "storage_file",
    targetId: path,
  });

  res.status(200).json({ ok: true });
}
