import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

// Owner-only: removes a channel+platform pin, reverting that channel back
// to always resolving to the latest published release for that platform.
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

  const { projectId, channel, platform } = req.body || {};
  if (!projectId || !channel || !platform) {
    res.status(400).json({ error: "Missing projectId/channel/platform" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can unpin a channel" });
    return;
  }

  const service = createServiceClient();
  const { error } = await service
    .from("channel_pins")
    .delete()
    .eq("project_id", projectId)
    .eq("channel", channel)
    .eq("platform", platform);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
