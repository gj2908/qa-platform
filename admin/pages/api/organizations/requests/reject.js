import { createServiceClient } from "../../../../lib/supabase";
import { requireAdmin } from "../../../../lib/requireAdmin";
import { logAdminAction } from "../../../../lib/logAdminAction";

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

  const { requestId } = req.body || {};
  if (!requestId) {
    res.status(400).json({ error: "Missing requestId" });
    return;
  }

  const service = createServiceClient();
  const { data: request } = await service.from("organization_requests").select("*").eq("id", requestId).single();
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (request.status !== "pending") {
    res.status(400).json({ error: "This request has already been resolved" });
    return;
  }

  const { error } = await service
    .from("organization_requests")
    .update({ status: "rejected", resolved_by: admin.email, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "organization_request_rejected",
    targetType: "organization_request",
    targetId: requestId,
    detail: `${request.type}: ${request.org_name || request.org_id} (requested by ${request.requester_email})`,
  });

  res.status(200).json({ ok: true });
}
