import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { sendWebhookNotification, buildCollaboratorPayload } from "../../../lib/webhookNotify";

const VALID_ROLES = ["viewer", "commenter", "editor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Also used to change an existing collaborator's role — the unique
// (project_id, email) constraint makes this an upsert. Accepts either a
// single `email` (existing shape, unchanged response) or an `emails`
// array (bulk invite from collaborators.js, returns a per-email result
// list instead of a single ok/error).
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

  const { projectId, email, emails, role } = req.body || {};
  const isBulk = Array.isArray(emails);
  const rawList = isBulk ? emails : [email];

  if (!projectId || rawList.length === 0 || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "A project, at least one email, and a role are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can add collaborators" });
    return;
  }

  const service = createServiceClient();
  const { data: project } = await service.from("projects").select("webhook_url").eq("id", projectId).single();

  const results = [];
  for (const raw of rawList) {
    const normalizedEmail = (raw || "").trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      results.push({ email: raw, ok: false, error: "Not a valid email address" });
      continue;
    }
    if (normalizedEmail === user.email) {
      results.push({ email: normalizedEmail, ok: false, error: "You're already the owner of this project" });
      continue;
    }

    const { error } = await authSupabase
      .from("project_collaborators")
      .upsert({ project_id: projectId, email: normalizedEmail, role }, { onConflict: "project_id,email" });

    if (error) {
      results.push({ email: normalizedEmail, ok: false, error: error.message });
      continue;
    }

    results.push({ email: normalizedEmail, ok: true });

    await logActivity(service, {
      projectId,
      actorEmail: user.email,
      action: "collaborator_added",
      detail: `${normalizedEmail} as ${role}`,
    });

    try {
      if (project?.webhook_url) {
        await sendWebhookNotification(
          project.webhook_url,
          buildCollaboratorPayload({ email: normalizedEmail, role, action: "added" }),
          { service, projectId, event: "collaborator_added" }
        );
      }
    } catch (e) {
      // ignored
    }
  }

  if (!isBulk) {
    const only = results[0];
    if (!only.ok) {
      res.status(400).json({ error: only.error });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(200).json({ results });
}
