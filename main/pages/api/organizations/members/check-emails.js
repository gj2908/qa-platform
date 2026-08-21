import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Called before the real /api/organizations/members/add.js submit, so
// the client can decide whether to show InviteEmailPrompt: which of the
// entered emails don't have an account yet, and whether the caller has
// already said "always"/"never" send the invite (skip asking). Mirrors
// pages/api/collaborators/check-emails.js's shape for the project side.
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

  const { orgId, emails } = req.body || {};
  const normalizedEmails = [
    ...new Set((Array.isArray(emails) ? emails : []).map((e) => (e || "").trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))),
  ];
  if (!orgId || normalizedEmails.length === 0) {
    res.status(400).json({ error: "An organization and at least one valid email are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can add members" });
    return;
  }

  const service = createServiceClient();

  const { data: registeredProfiles } = await service.from("profiles").select("email").in("email", normalizedEmails);
  const registeredSet = new Set((registeredProfiles || []).map((p) => p.email));
  const unregistered = normalizedEmails.filter((e) => !registeredSet.has(e));

  const { data: callerProfile } = await service
    .from("profiles")
    .select("invite_unregistered_preference")
    .eq("id", user.id)
    .maybeSingle();

  res.status(200).json({
    unregistered,
    invitePreference: callerProfile?.invite_unregistered_preference || "ask",
  });
}
