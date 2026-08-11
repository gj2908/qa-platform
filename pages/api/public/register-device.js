import { createServiceClient } from "../../../lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { projectId, udid, deviceName, email } = req.body || {};
  const trimmedUdid = typeof udid === "string" ? udid.trim() : "";
  if (!projectId || !trimmedUdid) {
    res.status(400).json({ error: "Missing project or UDID" });
    return;
  }
  if (trimmedUdid.length > 100) {
    res.status(400).json({ error: "That doesn't look like a valid UDID." });
    return;
  }
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
    res.status(400).json({ error: "That doesn't look like a valid email address." });
    return;
  }

  const service = createServiceClient();
  const { data: project } = await service.from("projects").select("id").eq("id", projectId).single();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { error } = await service.from("registered_devices").insert({
    project_id: projectId,
    udid: trimmedUdid,
    device_name: (deviceName || "").trim() || null,
    submitted_by_email: trimmedEmail || null,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
