import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { sendWebhookNotification, buildCollaboratorPayload } from "../../../lib/webhookNotify";

const VALID_ROLES = ["viewer", "commenter", "editor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Also used to change an existing collaborator's role — the unique
// (project_id, email) constraint makes this an upsert.
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

  const { projectId, email, role } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!projectId || !EMAIL_RE.test(normalizedEmail) || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "A project, a valid email, and a role are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can add collaborators" });
    return;
  }

  if (normalizedEmail === user.email) {
    res.status(400).json({ error: "You're already the owner of this project" });
    return;
  }

  const { error } = await authSupabase
    .from("project_collaborators")
    .upsert(
      { project_id: projectId, email: normalizedEmail, role },
      { onConflict: "project_id,email" }
    );

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const service = createServiceClient();
  await logActivity(service, {
    projectId,
    actorEmail: user.email,
    action: "collaborator_added",
    detail: `${normalizedEmail} as ${role}`,
  });

  try {
    const { data: project } = await service.from("projects").select("webhook_url").eq("id", projectId).single();
    if (project?.webhook_url) {
      await sendWebhookNotification(
        project.webhook_url,
        buildCollaboratorPayload({ email: normalizedEmail, role, action: "added" })
      );
    }
  } catch (e) {
    // ignored
  }

  res.status(200).json({ ok: true });
}
