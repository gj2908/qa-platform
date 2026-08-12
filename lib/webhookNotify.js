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

// The optional third arg logs the attempt to webhook_deliveries so a
// failure isn't silently swallowed — pass it wherever the caller already
// has a service-role client and knows which project/event this is for.
// Logging itself is best-effort: a failure to write the log row never
// throws or affects the returned result.
export async function sendWebhookNotification(url, payload, log) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let result;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
        payload,
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
