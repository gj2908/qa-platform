import { createServerSupabase } from "../../../lib/supabase/server";

// org_admin-only: sets the org's default_webhook_url/default_require_approval,
// applied to a project only when it's attached and doesn't already have
// its own value — see set-org.js.
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

  const { orgId, defaultWebhookUrl, defaultRequireApproval } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can update project defaults" });
    return;
  }

  const { error } = await authSupabase
    .from("organizations")
    .update({
      default_webhook_url: defaultWebhookUrl || null,
      default_require_approval: !!defaultRequireApproval,
    })
    .eq("id", orgId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
