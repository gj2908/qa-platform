import { createServerSupabase } from "../../../lib/supabase/server";
import { logOrgActivity } from "../../../lib/logOrgActivity";

// POST creates the org's announcement (org_admin only — RLS backs this
// up too, this is just for a friendly error message). DELETE clears it
// early; letting it simply expire via expires_at is the other path.
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
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

  const { orgId } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can manage the announcement" });
    return;
  }

  if (req.method === "DELETE") {
    const { announcementId } = req.body || {};
    if (!announcementId) {
      res.status(400).json({ error: "Missing announcementId" });
      return;
    }
    const { error } = await authSupabase
      .from("org_announcements")
      .delete()
      .eq("id", announcementId)
      .eq("org_id", orgId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  const { message, expiresAt } = req.body || {};
  const trimmed = (message || "").trim();
  if (!trimmed) {
    res.status(400).json({ error: "A message is required." });
    return;
  }

  const { data: announcement, error } = await authSupabase
    .from("org_announcements")
    .insert({
      org_id: orgId,
      message: trimmed,
      created_by: user.id,
      expires_at: expiresAt || null,
    })
    .select("id, message, created_at, expires_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logOrgActivity(authSupabase, {
    orgId,
    actorEmail: user.email,
    action: "org_announcement_created",
    detail: trimmed.slice(0, 100),
  });

  res.status(200).json({ ok: true, announcement });
}
