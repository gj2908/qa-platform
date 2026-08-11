import { createServerSupabase } from "../../../lib/supabase/server";

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

  const { projectId, deviceId } = req.body || {};
  if (!projectId || !deviceId) {
    res.status(400).json({ error: "Missing projectId or deviceId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can remove a registered device" });
    return;
  }

  const { error } = await authSupabase.from("registered_devices").delete().eq("id", deviceId).eq("project_id", projectId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
