import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";

// Saves or clears a project's outgoing release-notification URL.
// Owner-only, same permission model as collaborator management.
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

  const { projectId, webhookUrl } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "A project is required." });
    return;
  }

  const trimmed = typeof webhookUrl === "string" ? webhookUrl.trim() : "";
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
    } catch (e) {
      res.status(400).json({ error: "Enter a valid http(s) URL, or leave it blank to clear it." });
      return;
    }
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can change the webhook URL" });
    return;
  }

  const { error } = await authSupabase
    .from("projects")
    .update({ webhook_url: trimmed || null })
    .eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(createServiceClient(), {
    projectId,
    actorEmail: user.email,
    action: "webhook_updated",
    detail: trimmed ? "URL set" : "URL cleared",
  });

  res.status(200).json({ ok: true });
}
