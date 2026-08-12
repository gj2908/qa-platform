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

  const { releaseIds } = req.body || {};
  if (!Array.isArray(releaseIds) || releaseIds.length === 0) {
    res.status(400).json({ error: "Missing releaseIds" });
    return;
  }

  const service = createServiceClient();
  const { data: releases } = await service.from("releases").select("id, file_path").in("id", releaseIds).is("project_id", null);
  const filePaths = (releases || []).map((r) => r.file_path).filter(Boolean);
  if (filePaths.length > 0) {
    await service.storage.from("builds").remove(filePaths);
  }

  const { error } = await service.from("releases").delete().in("id", releaseIds).is("project_id", null);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "uploads_deleted",
    targetType: "upload",
    targetId: releaseIds.join(","),
    detail: `${releaseIds.length} upload(s)`,
  });

  res.status(200).json({ ok: true });
}
