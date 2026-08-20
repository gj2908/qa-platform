import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";

// org_admin-only: asks a platform operator to close this organization,
// rather than it being either impossible or a silent unilateral delete.
// Fulfillment happens from admin/'s request queue.
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

  const { orgId, reason } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (role !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can request closure" });
    return;
  }

  const { error } = await authSupabase.from("organization_requests").insert({
    requester_email: user.email,
    type: "close",
    org_id: orgId,
    reason: (reason || "").trim() || null,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logOrgActivity(createServiceClient(), {
    orgId,
    actorEmail: user.email,
    action: "org_closure_requested",
    detail: reason || null,
  });

  res.status(200).json({ ok: true });
}
