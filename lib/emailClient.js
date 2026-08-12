// Thin Resend REST API client, mirroring lib/aiClient.js's best-effort,
// timeout-guarded fetch pattern. RESEND_API_KEY isn't configured in this
// environment yet — every caller must keep working (no digest sent,
// no error surfaced to the user) until it is.
const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_FROM = "QA Platform <notifications@resend.dev>";

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email is not configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to,
        subject,
        html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Email request failed (${res.status}): ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}
