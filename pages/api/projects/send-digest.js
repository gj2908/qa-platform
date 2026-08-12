import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { buildDigest } from "../../../lib/buildDigest";
import { sendEmail } from "../../../lib/emailClient";

// Manual "Send test digest" trigger — sends to the requesting owner's own
// email so they can preview the digest without waiting for the daily
// cron or emailing the whole team. Ignores hasContent (a test send
// should always go out, even on a quiet project) unlike the cron path.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user?.email) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { projectId } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "A project is required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can send a test digest" });
    return;
  }

  const service = createServiceClient();
  const { data: project } = await service.from("projects").select("id, name").eq("id", projectId).single();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const digest = await buildDigest(service, project);
  const result = await sendEmail({ to: user.email, subject: `[Test] ${digest.subject}`, html: digest.html });

  if (!result.ok) {
    res.status(502).json({ error: result.error || "Couldn't send the digest email." });
    return;
  }

  res.status(200).json({ ok: true });
}
