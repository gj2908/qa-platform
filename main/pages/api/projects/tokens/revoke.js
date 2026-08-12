import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { logActivity } from "../../../../lib/logActivity";

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
  const { data: tokenRow } = await service
    .from("api_tokens")
    .select("label, token_prefix")
    .eq("id", tokenId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await service.from("api_tokens").delete().eq("id", tokenId).eq("project_id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(service, {
    projectId,
    actorEmail: user.email,
    action: "api_token_revoked",
    detail: tokenRow?.label || tokenRow?.token_prefix || null,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({ ok: true });
}
