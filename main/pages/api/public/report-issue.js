import { createServiceClient } from "../../../lib/supabase/server";
import { triageFeedback } from "../../../lib/aiClient";
import { sendWebhookNotification, buildFeedbackPayload } from "../../../lib/webhookNotify";
import { checkRateLimit, clientIp } from "../../../lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FEEDBACK_LENGTH = 5000;

// Tester feedback from the public share/distribute pages, filed straight
// onto the release's project board. Deliberately unauthenticated (see
// middleware.js's isPublicUploadApi exemption) — anyone with the share
// link can report an issue, same trust model as viewing/installing it.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { releaseId, feedback, reporterEmail, screenshotPath } = req.body || {};

  const trimmedFeedback = typeof feedback === "string" ? feedback.trim() : "";
  if (!trimmedFeedback) {
    res.status(400).json({ error: "Feedback is required." });
    return;
  }
  if (trimmedFeedback.length > MAX_FEEDBACK_LENGTH) {
    res.status(400).json({ error: "Feedback is too long." });
    return;
  }

  const email = typeof reporterEmail === "string" ? reporterEmail.trim().toLowerCase() : "";
  if (email && !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "That doesn't look like a valid email address." });
    return;
  }

  if (typeof releaseId !== "string" || !releaseId) {
    res.status(400).json({ error: "Missing release." });
    return;
  }

  const service = createServiceClient();

  const rate = await checkRateLimit(service, `report-issue:${clientIp(req)}`, {
    maxAttempts: 20,
    windowMinutes: 60,
    settingsKeyPrefix: "report_issue",
  });
  if (!rate.allowed) {
    res.status(429).json({ error: "Too many reports from this connection. Please try again in an hour." });
    return;
  }

  const { data: release } = await service
    .from("releases")
    .select("id, project_id, app_name, version, build_number, platform")
    .eq("id", releaseId)
    .eq("status", "published")
    .single();

  if (!release) {
    res.status(404).json({ error: "Release not found." });
    return;
  }
  if (!release.project_id) {
    res.status(400).json({ error: "This build has no project board to report to." });
    return;
  }

  // Defense against path traversal / cross-release references — the
  // signed upload URL (sign-feedback-upload.js) always scopes the path
  // to this exact releaseId, so anything else is either forged or stale.
  const safeScreenshotPath =
    typeof screenshotPath === "string" && screenshotPath.startsWith(`${releaseId}/`) ? screenshotPath : null;

  const title = trimmedFeedback.length > 80 ? `${trimmedFeedback.slice(0, 77)}...` : trimmedFeedback;
  const buildLabel = `${release.app_name || "Build"} v${release.version}${
    release.build_number ? ` (${release.build_number})` : ""
  } — ${release.platform}`;
  const description = `${trimmedFeedback}\n\n— Reported by ${
    email || "anonymous"
  } on ${buildLabel} (release ${release.id})`;

  // Best-effort AI triage — never blocks the report if it fails or
  // ANTHROPIC_API_KEY isn't configured.
  let aiCategory = null;
  let aiSeverity = null;
  try {
    const triage = await triageFeedback(trimmedFeedback);
    if (triage.ok) {
      aiCategory = triage.category;
      aiSeverity = triage.severity;
    }
  } catch (e) {
    // ignored
  }

  const { error: insertError } = await service.from("tasks").insert({
    project_id: release.project_id,
    title,
    description,
    status: "backlog",
    source: "tester_feedback",
    ai_category: aiCategory,
    ai_severity: aiSeverity,
    screenshot_path: safeScreenshotPath,
    created_by: null,
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  // Best-effort webhook notification — same "never block the real
  // action" rule as every other notification trigger in this app.
  try {
    const { data: project } = await service.from("projects").select("webhook_url").eq("id", release.project_id).single();
    if (project?.webhook_url) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      await sendWebhookNotification(
        project.webhook_url,
        buildFeedbackPayload({
          appName: release.app_name,
          feedback: trimmedFeedback,
          reporterEmail: email,
          boardUrl: `${protocol}://${host}/projects/${release.project_id}/board`,
        }),
        { service, projectId: release.project_id, event: "tester_feedback" }
      );
    }
  } catch (e) {
    // ignored
  }

  res.status(200).json({ ok: true });
}
