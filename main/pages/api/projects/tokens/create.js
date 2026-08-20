import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { generateToken } from "../../../../lib/apiTokens";
import { logActivity } from "../../../../lib/logActivity";

// Owner-only: generates a new CI/CD API token for a project. The raw
// token is returned exactly once here and never retrievable again —
// only its hash and a display prefix are persisted.
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

  const { projectId, label, scope } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "A project is required." });
    return;
  }
  const tokenScope = scope || "publish";
  if (!["read", "publish"].includes(tokenScope)) {
    res.status(400).json({ error: "scope must be 'read' or 'publish'" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can create API tokens" });
    return;
  }

  const { raw, hash, prefix } = generateToken();
  const service = createServiceClient();
  const { data: token, error } = await service
    .from("api_tokens")
    .insert({
      project_id: projectId,
      token_hash: hash,
      token_prefix: prefix,
      label: (label || "").trim() || null,
      scope: tokenScope,
      created_by: user.id,
    })
    .select("id, token_prefix, label, created_at, scope")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(service, {
    projectId,
    actorEmail: user.email,
    action: "api_token_created",
    detail: token.label || token.token_prefix,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({ token: raw, ...token });
}
