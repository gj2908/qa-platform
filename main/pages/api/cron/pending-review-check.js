import { createServiceClient } from "../../../lib/supabase/server";
import { notifyProjectWebhooks, buildApprovalReminderPayload } from "../../../lib/webhookNotify";
import { sendEmail, renderEmail, EMAIL_STYLES } from "../../../lib/emailClient";
import { getSetting } from "../../../lib/platformSettings";

const REMINDER_THRESHOLD_HOURS = 24;

// Nudges once per release when it's sat in pending_review too long —
// gated by CRON_SECRET exactly like pages/api/cron/digest.js. Fires
// regardless of whether a webhook/email channel is actually configured;
// approval_reminder_sent_at is stamped either way so a project with
// neither configured doesn't get re-checked forever.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const service = createServiceClient();
  const thresholdHours = Number(await getSetting(service, "approval_reminder_hours", REMINDER_THRESHOLD_HOURS));
  const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

  const { data: releases } = await service
    .from("releases")
    .select("id, project_id, app_name, version, platform, created_at")
    .eq("status", "pending_review")
    .lt("created_at", cutoff)
    .is("approval_reminder_sent_at", null);

  let reminded = 0;

  for (const release of releases || []) {
    const { data: project } = await service
      .from("projects")
      .select("name, webhook_url, org_id")
      .eq("id", release.project_id)
      .single();

    const hoursWaiting = Math.floor((Date.now() - new Date(release.created_at).getTime()) / (60 * 60 * 1000));
    const changelogUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/projects/${release.project_id}/changelog`;

    if (project?.webhook_url || project?.org_id) {
      await notifyProjectWebhooks(
        service,
        { id: release.project_id, webhook_url: project.webhook_url, org_id: project.org_id },
        buildApprovalReminderPayload({
          appName: release.app_name,
          version: release.version,
          platform: release.platform,
          hoursWaiting,
          changelogUrl,
        }),
        "release_pending_review_reminder"
      );
    }

    const { data: owner } = await service
      .from("project_collaborators")
      .select("email")
      .eq("project_id", release.project_id)
      .eq("role", "owner")
      .single();
    if (owner?.email) {
      await sendEmail({
        to: owner.email,
        subject: `${project?.name || "A project"}: build waiting for approval`,
        html: renderEmail({
          heading: "Build waiting for approval",
          bodyHtml: `<p ${EMAIL_STYLES.p}>${release.app_name || "A build"} v${release.version} (${
            release.platform
          }) has been waiting for approval for ${hoursWaiting} hours.</p>`,
          ctaLabel: "Review it",
          ctaUrl: changelogUrl,
        }),
      });
    }

    await service.from("releases").update({ approval_reminder_sent_at: new Date().toISOString() }).eq("id", release.id);
    reminded++;
  }

  res.status(200).json({ ok: true, reminded });
}
