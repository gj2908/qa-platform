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

  const { tokenId } = req.body || {};
  if (!tokenId) {
    res.status(400).json({ error: "Missing tokenId" });
    return;
  }

  const service = createServiceClient();
  const { data: token } = await service.from("api_tokens").select("label, token_prefix").eq("id", tokenId).single();

  const { error } = await service.from("api_tokens").delete().eq("id", tokenId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "token_revoked",
    targetType: "api_token",
    targetId: tokenId,
    detail: token?.label || token?.token_prefix || null,
  });

  res.status(200).json({ ok: true });
}
