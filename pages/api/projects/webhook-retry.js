import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { sendWebhookNotification } from "../../../lib/webhookNotify";

// Owner-only: re-sends a stored delivery's payload to the project's
// CURRENT webhook_url (which may have changed since the original
// attempt), logging a fresh delivery row.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { deliveryId } = req.body || {};
  if (!deliveryId) {
    res.status(400).json({ error: "Missing deliveryId" });
    return;
  }

  const service = createServiceClient();
  const { data: delivery } = await service
    .from("webhook_deliveries")
    .select("project_id, event, payload")
    .eq("id", deliveryId)
    .single();
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: delivery.project_id });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can retry a delivery" });
    return;
  }

  const { data: project } = await service.from("projects").select("webhook_url").eq("id", delivery.project_id).single();
  if (!project?.webhook_url) {
    res.status(400).json({ error: "This project no longer has a webhook URL configured." });
    return;
  }

  const result = await sendWebhookNotification(project.webhook_url, delivery.payload, {
    service,
    projectId: delivery.project_id,
    event: `${delivery.event} (retry)`,
  });

  if (!result.ok) {
    res.status(502).json({ error: result.error || `Endpoint responded with status ${result.status}` });
    return;
  }

  res.status(200).json({ ok: true });
}
