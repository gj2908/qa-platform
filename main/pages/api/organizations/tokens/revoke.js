import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { logOrgActivity } from "../../../../lib/logOrgActivity";

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

  const { orgId, tokenId } = req.body || {};
  if (!orgId || !tokenId) {
    res.status(400).json({ error: "Missing orgId or tokenId" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can revoke API tokens" });
    return;
  }

  const service = createServiceClient();
  const { data: tokenRow } = await service
    .from("org_api_tokens")
    .select("label, token_prefix")
    .eq("id", tokenId)
    .eq("org_id", orgId)
    .maybeSingle();

  const { error } = await service.from("org_api_tokens").delete().eq("id", tokenId).eq("org_id", orgId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logOrgActivity(service, {
    orgId,
    actorEmail: user.email,
    action: "org_api_token_revoked",
    detail: tokenRow?.label || tokenRow?.token_prefix || null,
  });

  res.status(200).json({ ok: true });
}
