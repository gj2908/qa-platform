import { createServerSupabase } from "../../../lib/supabase/server";

// Org creation is admin-fulfilled, not self-serve (see supabase/schema.sql —
// organizations has no insert policy for regular users anymore). This
// files a request instead; a platform operator reviews and provisions
// it from admin/'s request queue.
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

  const { name, reason } = req.body || {};
  if (!name || !name.trim()) {
    res.status(400).json({ error: "An organization name is required" });
    return;
  }

  const { error } = await authSupabase.from("organization_requests").insert({
    requester_email: user.email,
    type: "create",
    org_name: name.trim(),
    reason: (reason || "").trim() || null,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
