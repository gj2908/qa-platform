import { randomUUID } from "crypto";
import { createServerSupabase } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";

const ACTIONS = ["enable", "disable", "regenerate"];
const ACTIVITY_ACTION = {
  enable: "org_invite_link_enabled",
  disable: "org_invite_link_disabled",
  regenerate: "org_invite_link_regenerated",
};

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

  const { orgId, action } = req.body || {};
  if (!orgId || !ACTIONS.includes(action)) {
    res.status(400).json({ error: "An organization and a valid action are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can manage the invite link" });
    return;
  }

  const update =
    action === "regenerate"
      ? { invite_token: randomUUID(), invite_enabled: true }
      : { invite_enabled: action === "enable" };

  const { data: org, error } = await authSupabase
    .from("organizations")
    .update(update)
    .eq("id", orgId)
    .select("invite_token, invite_enabled")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logOrgActivity(authSupabase, {
    orgId,
    actorEmail: user.email,
    action: ACTIVITY_ACTION[action],
    detail: null,
  });

  res.status(200).json({ ok: true, inviteToken: org.invite_token, inviteEnabled: org.invite_enabled });
}
