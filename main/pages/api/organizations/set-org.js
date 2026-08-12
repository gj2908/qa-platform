import { createServerSupabase } from "../../../lib/supabase/server";

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

  if (orgId) {
    const { data: callerOrgRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
    if (callerOrgRole !== "org_admin") {
      res.status(403).json({ error: "You must be an admin of that organization" });
      return;
    }
  }

  const { error } = await authSupabase
    .from("projects")
    .update({ org_id: orgId || null })
    .eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
