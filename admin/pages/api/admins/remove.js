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

  const email = (req.body?.email || "").trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "Missing email" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.from("admin_allowlist").delete().eq("email", email);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "admin_removed",
    targetType: "admin_allowlist",
    targetId: email,
  });

  res.status(200).json({ ok: true });
}
