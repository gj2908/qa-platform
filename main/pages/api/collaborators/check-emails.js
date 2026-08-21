import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Called before the real /api/collaborators/add.js submit, so the client
// can decide whether to show InviteEmailPrompt: which of the entered
// emails don't have an account yet, and whether the caller has already
// said "always"/"never" send the invite (skip asking).
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

  const { projectId, emails } = req.body || {};
  const normalizedEmails = [
    ...new Set((Array.isArray(emails) ? emails : []).map((e) => (e || "").trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))),
  ];
  if (!projectId || normalizedEmails.length === 0) {
    res.status(400).json({ error: "A project and at least one valid email are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can add collaborators" });
    return;
  }

  const service = createServiceClient();

  // profiles rows only ever exist via handle_new_user()'s trigger on
  // auth.users insert — same reliable "has an account" proxy already
  // used by pages/api/organizations/members/add.js.
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
