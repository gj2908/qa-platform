import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

// Owner-only: pins a channel+platform to this specific release, overriding
// "latest published" resolution on /channel/[projectId]/[channel] — see
// channel_pins. Also used by the "Promote" button in changelog.js, which
// just computes the next channel and calls this same endpoint.
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

  const { releaseId, channel } = req.body || {};
  if (!releaseId || !["internal", "beta", "production"].includes(channel)) {
    res.status(400).json({ error: "Missing or invalid releaseId/channel" });
    return;
  }

  const service = createServiceClient();
  const { data: release } = await service
    .from("releases")
    .select("project_id, platform, status")
    .eq("id", releaseId)
    .single();
  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  if (release.status !== "published") {
    res.status(400).json({ error: "Only published releases can be pinned to a channel." });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: release.project_id });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can pin a channel" });
    return;
  }

  const { error } = await service.from("channel_pins").upsert(
    {
      project_id: release.project_id,
      channel,
      platform: release.platform,
      release_id: releaseId,
      pinned_by: user.id,
      pinned_at: new Date().toISOString(),
    },
    { onConflict: "project_id,channel,platform" }
  );
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
