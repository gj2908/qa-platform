import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";

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

  const { projectId } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const service = createServiceClient();

  const { data: releases } = await service.from("releases").select("file_path").eq("project_id", projectId);
  const filePaths = (releases || []).map((r) => r.file_path).filter(Boolean);
  if (filePaths.length > 0) {
    await service.storage.from("builds").remove(filePaths);
  }

  const { error } = await service.from("projects").delete().eq("id", projectId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
