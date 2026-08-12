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

  const { key, value } = req.body || {};
  if (!key) {
    res.status(400).json({ error: "Missing key" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service
    .from("platform_settings")
    .upsert({ key, value: String(value ?? ""), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
