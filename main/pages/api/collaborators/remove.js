import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { notifyProjectWebhooks, buildCollaboratorPayload } from "../../../lib/webhookNotify";

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

  const { projectId, email } = req.body || {};
  if (!projectId || !email) {
    res.status(400).json({ error: "Missing projectId or email" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can remove collaborators" });
    return;
  }

  if (email.trim().toLowerCase() === user.email) {
    res.status(400).json({ error: "The owner can't be removed — transfer ownership first" });
    return;
  }

  const { error } = await authSupabase
    .from("project_collaborators")
    .delete()
    .eq("project_id", projectId)
    .eq("email", email.trim().toLowerCase());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const service = createServiceClient();
  await logActivity(service, {
    projectId,
    actorEmail: user.email,
    action: "collaborator_removed",
    detail: email.trim().toLowerCase(),
  });

  try {
    const { data: project } = await service.from("projects").select("webhook_url, org_id").eq("id", projectId).single();
    if (project?.webhook_url || project?.org_id) {
      await notifyProjectWebhooks(
        service,
        { id: projectId, webhook_url: project.webhook_url, org_id: project.org_id },
        buildCollaboratorPayload({ email: email.trim().toLowerCase(), role: null, action: "removed" }),
        "collaborator_removed"
      );
    }
  } catch (e) {
    // ignored
  }

  res.status(200).json({ ok: true });
}
