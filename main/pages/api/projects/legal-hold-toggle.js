import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";

// Owner-only toggle. Uses the caller's own RLS-respecting client (the
// existing "owner update projects" policy already covers this column,
// no service role needed) — actual deletion is still independently
// blocked at the DB layer by trg_guard_legal_hold even if this route or
// its permission check were ever bypassed.
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

  const { projectId, legalHold } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can change this setting" });
    return;
  }

  const { error } = await authSupabase
    .from("projects")
    .update({ legal_hold: !!legalHold })
    .eq("id", projectId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(createServiceClient(), {
    projectId,
    actorEmail: user.email,
    action: "project_settings_updated",
    detail: `legal_hold set to ${!!legalHold}`,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({ ok: true });
}
