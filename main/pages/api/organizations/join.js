import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";

// Self-serve join via invite link. The caller isn't a member yet, so
// org_role()-backed RLS can't authorize this — possession of the
// unguessable invite_token is the permission check instead (same idea
// as /share/[id].js's unguessable release id), which is why this reads
// and writes through the service client rather than the RLS client.
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

  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ error: "Missing invite token" });
    return;
  }

  const service = createServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("id, name")
    .eq("invite_token", token)
    .eq("invite_enabled", true)
    .maybeSingle();

  if (!org) {
    res.status(404).json({ error: "This invite link is invalid or has been disabled." });
    return;
  }

  const { error } = await service
    .from("org_members")
    .upsert({ org_id: org.id, email: user.email, role: "member" }, { onConflict: "org_id,email" });

  if (error) {
    // Surfaces trg_guard_seat_limit's raised exception as a friendly message.
    res.status(400).json({ error: error.message });
    return;
  }

  await logOrgActivity(service, {
    orgId: org.id,
    actorEmail: user.email,
    action: "org_member_joined_via_link",
    detail: null,
  });

  res.status(200).json({ ok: true, orgId: org.id, orgName: org.name });
}
