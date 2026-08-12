import { createServerSupabase } from "../../../../lib/supabase/server";

const VALID_ROLES = ["org_admin", "member"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { orgId, email, role } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!orgId || !EMAIL_RE.test(normalizedEmail) || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "An organization, a valid email, and a role are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can add members" });
    return;
  }

  // Also used to change an existing member's role — the unique
  // (org_id, email) constraint makes this an upsert, same pattern as
  // /api/collaborators/add.js.
  const { error } = await authSupabase
    .from("org_members")
    .upsert({ org_id: orgId, email: normalizedEmail, role }, { onConflict: "org_id,email" });

  if (error) {
    // Surfaces trg_guard_seat_limit's raised exception as a friendly message.
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
