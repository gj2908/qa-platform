import { createServerSupabase } from "../../../lib/supabase/server";

// org_admin-only: toggles whether every member of this org must have a
// verified TOTP factor to use the app — see
// components/layout/RequireMfaGate.js for enforcement.
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

  const { orgId, mfaRequired } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can change this setting" });
    return;
  }

  const { error } = await authSupabase.from("organizations").update({ mfa_required: !!mfaRequired }).eq("id", orgId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await authSupabase.from("org_activity").insert({
    org_id: orgId,
    actor_email: user.email,
    action: mfaRequired ? "org_mfa_required_enabled" : "org_mfa_required_disabled",
  });

  res.status(200).json({ ok: true });
}
