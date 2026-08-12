import { createServerSupabase } from "../../../lib/supabase/server";

// Owner-only toggle. Uses the caller's own RLS-respecting client (the
// existing "owner update projects" policy already covers this column,
// no service role needed).
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

  const { projectId, digestEnabled } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can change this setting" });
    return;
  }

  const { error } = await authSupabase
    .from("projects")
    .update({ digest_enabled: !!digestEnabled })
    .eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
