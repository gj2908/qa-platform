import { createServerSupabase } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";

// Assigns or clears a project's org_id. Only a project owner can do this,
// and only into an org they're an org_admin of (or clear it entirely).
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

  const { projectId, orgId } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const { data: projectRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (projectRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can change its organization" });
    return;
  }

  const update = { org_id: orgId || null };

  if (orgId) {
    const { data: callerOrgRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
    if (callerOrgRole !== "org_admin") {
      res.status(403).json({ error: "You must be an admin of that organization" });
      return;
    }

    // Org-level defaults fill gaps only — never overwrite a value the
    // project already has of its own.
    const { data: project } = await authSupabase
      .from("projects")
      .select("webhook_url, require_approval")
      .eq("id", projectId)
      .single();
    const { data: org } = await authSupabase
      .from("organizations")
      .select("default_webhook_url, default_require_approval, name")
      .eq("id", orgId)
      .single();
    if (project && !project.webhook_url && org?.default_webhook_url) {
      update.webhook_url = org.default_webhook_url;
    }
    if (project && !project.require_approval && org?.default_require_approval) {
      update.require_approval = true;
    }
  }

  const { error } = await authSupabase.from("projects").update(update).eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (orgId) {
    const { data: project } = await authSupabase.from("projects").select("name").eq("id", projectId).single();
    await logOrgActivity(authSupabase, {
      orgId,
      actorEmail: user.email,
      action: "org_project_attached",
      detail: project?.name || null,
    });
  }

  res.status(200).json({ ok: true });
}
