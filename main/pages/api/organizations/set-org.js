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

  // Read once up front — needed either way: to log a detach against the
  // org it's leaving, and (for attach) to check org-default gaps below.
  const { data: projectBefore } = await authSupabase
    .from("projects")
    .select("name, org_id, webhook_url, require_approval")
    .eq("id", projectId)
    .single();

  const update = { org_id: orgId || null };

  if (orgId) {
    const { data: callerOrgRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
    if (callerOrgRole !== "org_admin") {
      res.status(403).json({ error: "You must be an admin of that organization" });
      return;
    }

    // Org-level defaults fill gaps only — never overwrite a value the
    // project already has of its own.
    const { data: org } = await authSupabase
      .from("organizations")
      .select("default_webhook_url, default_require_approval, name")
      .eq("id", orgId)
      .single();
    if (projectBefore && !projectBefore.webhook_url && org?.default_webhook_url) {
      update.webhook_url = org.default_webhook_url;
    }
    if (projectBefore && !projectBefore.require_approval && org?.default_require_approval) {
      update.require_approval = true;
    }
  }

  const { error } = await authSupabase.from("projects").update(update).eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (orgId) {
    await logOrgActivity(authSupabase, {
      orgId,
      actorEmail: user.email,
      action: "org_project_attached",
      detail: projectBefore?.name || null,
    });
  } else if (projectBefore?.org_id) {
    // Symmetric with the attach path above — without this, every removal
    // silently vanished from the org's activity feed while every addition
    // showed up (only noticed once a "remove" UI existed to trigger it).
    await logOrgActivity(authSupabase, {
      orgId: projectBefore.org_id,
      actorEmail: user.email,
      action: "org_project_detached",
      detail: projectBefore.name || null,
    });
  }

  res.status(200).json({ ok: true });
}
