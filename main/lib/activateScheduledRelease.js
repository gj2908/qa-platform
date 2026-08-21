import { logActivity } from "./logActivity";
import { notifyProjectWebhooks, buildReleasePayload } from "./webhookNotify";

// Scheduled releases activate lazily: the first page load (distribute,
// share, or changelog) after scheduled_for has passed flips the release
// to "published" and fires the normal activity/webhook at that moment —
// no background cron needed. No-op if the release isn't due yet.
export async function activateScheduledReleaseIfDue(service, release, req) {
  if (release.status !== "scheduled" || !release.scheduled_for) return release;
  if (new Date(release.scheduled_for) > new Date()) return release;

  const { data: updated } = await service
    .from("releases")
    .update({ status: "published" })
    .eq("id", release.id)
    .eq("status", "scheduled") // avoid double-activation races
    .select()
    .single();

  if (!updated) return release;

  let actorEmail = "scheduled release";
  if (updated.created_by) {
    const { data: creator } = await service.auth.admin.getUserById(updated.created_by);
    actorEmail = creator?.user?.email || actorEmail;
  }

  await logActivity(service, {
    projectId: updated.project_id,
    actorEmail,
    action: "release_published",
    detail: `${updated.platform} v${updated.version}${updated.build_number ? ` (${updated.build_number})` : ""} (scheduled)`,
  });

  try {
    const { data: project } = await service
      .from("projects")
      .select("webhook_url, org_id")
      .eq("id", updated.project_id)
      .single();
    if ((project?.webhook_url || project?.org_id) && req) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      await notifyProjectWebhooks(
        service,
        { id: updated.project_id, webhook_url: project.webhook_url, org_id: project.org_id },
        buildReleasePayload({
          appName: updated.app_name,
          version: updated.version,
          buildNumber: updated.build_number,
          platform: updated.platform,
          installUrl: `${protocol}://${host}/distribute/${updated.id}`,
        }),
        "release_published"
      );
    }
  } catch (e) {
    // ignored — notification failures never affect activation
  }

  return updated;
}
