// Best-effort outgoing release notifications for a project's configured
// webhook_url. Payload shape ({ text }) matches Slack incoming webhooks
// and degrades gracefully for any generic JSON-consuming endpoint.
const FETCH_TIMEOUT_MS = 5000;

export function buildReleasePayload({ appName, version, buildNumber, platform, installUrl }) {
  const versionLabel = buildNumber ? `${version} (${buildNumber})` : version;
  const platformLabel = { ios: "iOS", android: "Android", web: "Web" }[platform] || platform;
  return {
    text: `📦 *${appName || "New build"}* — new ${platformLabel} build published\nVersion: ${versionLabel}\nInstall: ${installUrl}`,
  };
}

export function buildFeedbackPayload({ appName, feedback, reporterEmail, boardUrl }) {
  const preview = feedback.length > 200 ? `${feedback.slice(0, 197)}...` : feedback;
  return {
    text: `🐞 *${appName || "App"}* — new tester feedback from ${reporterEmail || "anonymous"}\n${preview}\nBoard: ${boardUrl}`,
  };
}

export function buildCollaboratorPayload({ email, role, action }) {
  const verb = action === "added" ? "added to" : "removed from";
  return {
    text: `👤 *${email}* was ${verb} the project${role ? ` as ${role}` : ""}.`,
  };
}

export function buildApprovalReminderPayload({ appName, version, platform, hoursWaiting, changelogUrl }) {
  const platformLabel = { ios: "iOS", android: "Android", web: "Web" }[platform] || platform;
  return {
    text: `⏳ *${appName || "A build"}* — ${platformLabel} v${version} has been waiting for approval for ${hoursWaiting}h.\nReview: ${changelogUrl}`,
  };
}

export function buildTaskOverduePayload({ appName, taskTitle, assigneeEmail, boardUrl }) {
  return {
    text: `📅 *${appName || "A project"}* — "${taskTitle}" is overdue${assigneeEmail ? ` (assigned to ${assigneeEmail})` : ""}.\nBoard: ${boardUrl}`,
  };
}

// Microsoft Teams incoming webhooks (whether the legacy Office 365
// Connector or a Workflows-based one) don't render the {text} shape or
// Slack's *bold* markdown — they expect a MessageCard. Detected by URL
// host rather than a project-level setting, so an org can point
// webhook_url at either provider with zero extra configuration.
function isTeamsWebhook(url) {
  try {
    return /(^|\.)(office\.com|office365\.com|logic\.azure\.com)$/i.test(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

function toTeamsMessageCard(payload) {
  const text = (payload.text || "").replace(/\*(.+?)\*/g, "$1");
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: text.split("\n")[0]?.slice(0, 100) || "Notification",
    text,
  };
}

// The optional third arg logs the attempt to webhook_deliveries so a
// failure isn't silently swallowed — pass it wherever the caller already
// has a service-role client and knows which project/event this is for.
// Logging itself is best-effort: a failure to write the log row never
// throws or affects the returned result.
export async function sendWebhookNotification(url, payload, log) {
  const body = isTeamsWebhook(url) ? toTeamsMessageCard(payload) : payload;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let result;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    result = { ok: res.ok, status: res.status };
  } catch (e) {
    result = { ok: false, error: e.message };
  } finally {
    clearTimeout(timeout);
  }

  if (log?.service && log?.projectId && log?.event) {
    try {
      await log.service.from("webhook_deliveries").insert({
        project_id: log.projectId,
        event: log.event,
        payload: body,
        status: result.ok ? "success" : "failed",
        response_status: result.status ?? null,
        error: result.error || (result.ok ? null : `Endpoint responded with status ${result.status}`),
      });
    } catch (e) {
      // ignored — logging failures never affect the notification result
    }
  }

  return result;
}

// Fires a webhook-notifying event to every URL configured for a project:
// its own `webhook_url` (if set) and, when the project belongs to an org,
// that org's `default_webhook_url` (if set) — live fan-out, not just the
// one-time copy applied at org-attach time. Both sends are independent and
// best-effort: either can fail without affecting the other or the caller.
// `project` only needs `webhook_url` and `org_id`. `log` is passed through
// unchanged to each `sendWebhookNotification` call so `webhook_deliveries`
// gets a row per URL, same as today.
export async function notifyProjectWebhooks(service, project, payload, event) {
  const log = { service, projectId: project?.id, event };
  const sends = [];

  if (project?.webhook_url) {
    sends.push(sendWebhookNotification(project.webhook_url, payload, log));
  }

  if (project?.org_id) {
    try {
      const { data: org } = await service
        .from("organizations")
        .select("default_webhook_url")
        .eq("id", project.org_id)
        .single();

      if (org?.default_webhook_url && org.default_webhook_url !== project.webhook_url) {
        sends.push(sendWebhookNotification(org.default_webhook_url, payload, log));
      }
    } catch (e) {
      // ignored — org lookup failure never blocks the project's own webhook
    }
  }

  await Promise.allSettled(sends);
}
