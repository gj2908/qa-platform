import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { generateToken } from "../../../../lib/apiTokens";
import { logOrgActivity } from "../../../../lib/logOrgActivity";

// Org-admin-only: generates a new org-scoped API token. Unlike a
// project token, an org token has no scope selector — it's always
// 'read' (enforced again at the DB level by org_api_tokens' check
// constraint), since publishing a release requires picking one specific
// project, which an org token doesn't have. The raw token is returned
// exactly once here and never retrievable again — only its hash and a
// display prefix are persisted. Mirrors
// pages/api/projects/tokens/create.js's shape.
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

  const { orgId, label } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "An organization is required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can create API tokens" });
    return;
  }

  const { raw, hash, prefix } = generateToken();
  const service = createServiceClient();
  const { data: token, error } = await service
    .from("org_api_tokens")
    .insert({
      org_id: orgId,
      token_hash: hash,
      token_prefix: prefix,
      label: (label || "").trim() || null,
      scope: "read",
      created_by: user.id,
    })
    .select("id, token_prefix, label, created_at, scope")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logOrgActivity(service, {
    orgId,
    actorEmail: user.email,
    action: "org_api_token_created",
    detail: token.label || token.token_prefix,
  });

  res.status(200).json({ token: raw, ...token });
}
