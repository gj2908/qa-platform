import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";

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

  const { projectId, tokenId } = req.body || {};
  if (!projectId || !tokenId) {
    res.status(400).json({ error: "Missing projectId or tokenId" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can revoke API tokens" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service.from("api_tokens").delete().eq("id", tokenId).eq("project_id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
