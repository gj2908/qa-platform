import { randomUUID } from "crypto";
import { createServiceClient } from "../../../../lib/supabase";
import { requireAdmin } from "../../../../lib/requireAdmin";
import { logAdminAction } from "../../../../lib/logAdminAction";

// Fulfills an organization_requests row. 'create' provisions the org
// with created_by set to the *requester's* auth id — trg_assign_org_admin
// keys off that column, so the requester (not the platform operator
// running this route) ends up as the org's first org_admin. 'close'
// deletes the org the same way admin/'s existing delete.js already
// does (projects.org_id is on delete set null — never deletes projects).
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

  if (request.type === "create") {
    const { data: profile } = await service.from("profiles").select("id").eq("email", request.requester_email).maybeSingle();
    if (!profile) {
      res.status(400).json({ error: "The requester's account could not be found" });
      return;
    }

    const orgId = randomUUID();
    const { error: insertError } = await service.from("organizations").insert({
      id: orgId,
      name: request.org_name,
      created_by: profile.id,
    });
    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    await service.from("org_activity").insert({
      org_id: orgId,
      actor_email: admin.email,
      action: "org_creation_approved",
      detail: `requested by ${request.requester_email}`,
    });

    await service
      .from("organization_requests")
      .update({ status: "approved", resolved_by: admin.email, resolved_at: new Date().toISOString(), org_id: orgId })
      .eq("id", requestId);

    await logAdminAction(service, {
      adminEmail: admin.email,
      action: "organization_request_approved",
      targetType: "organization",
      targetId: orgId,
      detail: `create: ${request.org_name} (requested by ${request.requester_email})`,
    });

    res.status(200).json({ ok: true, orgId });
    return;
  }

  // type === "close"
  if (!request.org_id) {
    res.status(400).json({ error: "This request has no organization attached" });
    return;
  }
  const { data: orgRow } = await service.from("organizations").select("name").eq("id", request.org_id).single();

  const { error: deleteError } = await service.from("organizations").delete().eq("id", request.org_id);
  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  await service
    .from("organization_requests")
    .update({ status: "approved", resolved_by: admin.email, resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "organization_request_approved",
    targetType: "organization",
    targetId: request.org_id,
    detail: `close: ${orgRow?.name || request.org_id} (requested by ${request.requester_email})`,
  });

  res.status(200).json({ ok: true });
}
