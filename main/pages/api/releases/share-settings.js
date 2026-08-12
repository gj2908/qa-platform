import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { hashToken } from "../../../lib/apiTokens";

// Owner/editor: sets a release's share-link expiry, PIN, and rollout
// percentage in one call — all three are "who can install this link"
// controls surfaced together on the distribute page.
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

  const { releaseId, shareExpiresAt, pin, clearPin, rolloutPercent } = req.body || {};
  if (!releaseId) {
    res.status(400).json({ error: "Missing releaseId" });
    return;
  }

  const service = createServiceClient();
  const { data: release } = await service.from("releases").select("project_id").eq("id", releaseId).single();
  if (!release?.project_id) {
    res.status(404).json({ error: "Release not found" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: release.project_id });
  if (role !== "owner" && role !== "editor") {
    res.status(403).json({ error: "You don't have permission to change this release's share settings" });
    return;
  }

  if (
    rolloutPercent != null &&
    (typeof rolloutPercent !== "number" || rolloutPercent < 1 || rolloutPercent > 99)
  ) {
    res.status(400).json({ error: "Rollout percent must be between 1 and 99, or left unset for 100%." });
    return;
  }

  const update = {
    share_expires_at: shareExpiresAt || null,
    rollout_percent: rolloutPercent ?? null,
  };
  if (clearPin) {
    update.share_pin_hash = null;
  } else if (pin) {
    if (!/^\d{4,8}$/.test(pin)) {
      res.status(400).json({ error: "PIN must be 4-8 digits." });
      return;
    }
    update.share_pin_hash = hashToken(pin);
  }

  const { error } = await service.from("releases").update(update).eq("id", releaseId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
