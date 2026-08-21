import { randomUUID } from "crypto";
import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";

// Owner-only. Two independent things this can do to a project's public
// roadmap link:
//   - { projectId, enabled } toggles roadmap_enabled on/off.
//   - { projectId, regenerate: true } rolls roadmap_token to a fresh
//     uuid, same idea as organizations/invite-link.js's "regenerate"
//     action — invalidates every link already shared.
// Uses the caller's own RLS-respecting client for the write itself (the
// existing owner-only "update projects" policy already covers these two
// columns, no service role needed there) — service client is only used
// for the best-effort activity log, matching digest-toggle.js/
// legal-hold-toggle.js's shape.
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

  const { projectId, enabled, regenerate } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can change this setting" });
    return;
  }

  const update = regenerate ? { roadmap_token: randomUUID() } : { roadmap_enabled: !!enabled };
  const detail = regenerate ? "roadmap link regenerated" : `roadmap_enabled set to ${!!enabled}`;

  const { data: project, error } = await authSupabase
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .select("roadmap_enabled, roadmap_token")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(createServiceClient(), {
    projectId,
    actorEmail: user.email,
    action: "project_settings_updated",
    detail,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({
    ok: true,
    roadmapEnabled: project.roadmap_enabled,
    roadmapToken: project.roadmap_token,
  });
}
