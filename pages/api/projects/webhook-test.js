import { createServerSupabase } from "../../../lib/supabase/server";
import { sendWebhookNotification } from "../../../lib/webhookNotify";

// Sends a real test payload to the project's saved webhook and reports
// the actual result back — unlike the release-publish trigger, this path
// isn't fire-and-forget since verifying the URL works is its whole point.
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

  const { projectId } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "A project is required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can send a test notification" });
    return;
  }

  const { data: project } = await authSupabase
    .from("projects")
    .select("webhook_url")
    .eq("id", projectId)
    .single();

  if (!project?.webhook_url) {
    res.status(400).json({ error: "Save a webhook URL first." });
    return;
  }

  const result = await sendWebhookNotification(project.webhook_url, {
    text: "✅ Test notification from your QA platform project — this webhook is wired up correctly.",
  });

  if (!result.ok) {
    res.status(502).json({ error: result.error || `Endpoint responded with status ${result.status}` });
    return;
  }

  res.status(200).json({ ok: true });
}
