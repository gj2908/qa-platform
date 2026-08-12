import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.from("admin_allowlist").upsert({ email, added_by: admin.email });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "admin_added",
    targetType: "admin_allowlist",
    targetId: email,
  });

  res.status(200).json({ ok: true });
}
