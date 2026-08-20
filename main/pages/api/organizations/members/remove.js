import { createServerSupabase } from "../../../../lib/supabase/server";
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

  const { orgId, email } = req.body || {};
  if (!orgId || !email) {
    res.status(400).json({ error: "Missing orgId or email" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can remove members" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await authSupabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("email", normalizedEmail);

  if (error) {
    // Surfaces trg_guard_last_org_admin's raised exception (can't remove
    // the last org_admin) as a friendly message.
    res.status(400).json({ error: error.message });
    return;
  }

  await logOrgActivity(authSupabase, {
    orgId,
    actorEmail: user.email,
    action: "org_member_removed",
    detail: normalizedEmail,
  });

  res.status(200).json({ ok: true });
}
