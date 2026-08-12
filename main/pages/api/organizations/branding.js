import { createServerSupabase } from "../../../lib/supabase/server";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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

  const { orgId, logoUrl, accentColor } = req.body || {};
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  if (accentColor && !HEX_RE.test(accentColor)) {
    res.status(400).json({ error: "Accent color must be a hex code, e.g. #3358d4" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can update branding" });
    return;
  }

  const { error } = await authSupabase
    .from("organizations")
    .update({ logo_url: logoUrl || null, accent_color: accentColor || null })
    .eq("id", orgId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
