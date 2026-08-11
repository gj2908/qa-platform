import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { sendWebhookNotification, buildReleasePayload } from "../../../lib/webhookNotify";

// Owner-only: approves or rejects a release held as pending_review.
// Approving flips it to published and fires the same activity/webhook a
// direct publish would — from that point on it's indistinguishable from
// a release published outright.
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

  const { releaseId, action } = req.body || {};
  if (!releaseId || !["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "Missing releaseId or invalid action" });
    return;
  }

  const service = createServiceClient();
  const { data: release } = await service
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .eq("status", "pending_review")
    .single();
  if (!release) {
    res.status(404).json({ error: "No pending release found" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: release.project_id });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can approve or reject a release" });
    return;
  }

  if (action === "reject") {
    if (release.file_path) await service.storage.from("builds").remove([release.file_path]);
    await service.from("releases").delete().eq("id", releaseId);
    await logActivity(service, {
      projectId: release.project_id,
      actorEmail: user.email,
      action: "release_deleted",
      detail: `${release.platform} v${release.version}${release.build_number ? ` (${release.build_number})` : ""} (rejected)`,
    });
    res.status(200).json({ ok: true, action: "rejected" });
    return;
  }

  const { data: updated, error } = await service
    .from("releases")
    .update({ status: "published", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", releaseId)
    .select()
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logActivity(service, {
    projectId: release.project_id,
    actorEmail: user.email,
    action: "release_published",
    detail: `${updated.platform} v${updated.version}${updated.build_number ? ` (${updated.build_number})` : ""} (approved)`,
  });

  try {
    const { data: project } = await service.from("projects").select("webhook_url").eq("id", release.project_id).single();
    if (project?.webhook_url) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      await sendWebhookNotification(
        project.webhook_url,
        buildReleasePayload({
          appName: updated.app_name,
          version: updated.version,
          buildNumber: updated.build_number,
          platform: updated.platform,
          installUrl: `${protocol}://${host}/distribute/${updated.id}`,
        })
      );
    }
  } catch (e) {
    // ignored
  }

  res.status(200).json({ ok: true, action: "approved" });
}
