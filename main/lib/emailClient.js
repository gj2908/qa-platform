// Thin Resend REST API client, mirroring lib/aiClient.js's best-effort,
// timeout-guarded fetch pattern. RESEND_API_KEY isn't configured in this
// environment yet — every caller must keep working (no digest sent,
// no error surfaced to the user) until it is.
const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_FROM = "Vrsnify <notifications@resend.dev>";

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

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Escapes user-authored text (comment excerpts, release notes) before
// interpolating it into an email's HTML body.
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Shared branded shell for every transactional email this app sends —
// one visual language instead of each caller hand-rolling its own
// unstyled <p>/<h2> soup. Table-based layout on purpose: it's the one
// approach that renders consistently across email clients (Outlook in
// particular ignores flexbox/grid).
export function renderEmail({ heading, bodyHtml, ctaLabel, ctaUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      body { margin: 0; padding: 0; width: 100% !important; }
      @media screen and (max-width: 600px) {
        .email-container { width: 100% !important; }
        .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:32px 16px;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width:520px;margin:0 auto;">
            <tr>
              <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="email-padding" style="background-color:#3358d4;padding:18px 28px;">
                      <span style="color:#ffffff;font-size:15px;font-weight:600;letter-spacing:-0.01em;">Vrsnify</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-padding" style="padding:28px;color:#1f2430;font-size:14px;line-height:1.65;">
                      ${heading ? `<h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0a0a0a;">${heading}</h1>` : ""}
                      ${bodyHtml}
                      ${
                        ctaUrl
                          ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background-color:#3358d4;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:500;font-size:14px;">${
                              ctaLabel || "View"
                            }</a></div>`
                          : ""
                      }
                    </td>
                  </tr>
                  <tr>
                    <td class="email-padding" style="padding:16px 28px;border-top:1px solid #f0f1f3;">
                      <p style="margin:0;color:#9aa0ab;font-size:12px;">Sent by Vrsnify.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Inline styles for content built into renderEmail's bodyHtml slot —
// email HTML can't reliably rely on an external stylesheet, so every
// element needs its style attribute set directly. Shared here so the
// digest/release/mention/reminder emails don't each redefine these.
export const EMAIL_STYLES = {
  p: 'style="margin:0 0 12px;"',
  h3: 'style="margin:20px 0 8px;font-size:13px;font-weight:600;color:#0a0a0a;"',
  ul: 'style="margin:0 0 12px;padding-left:20px;"',
  li: 'style="margin:0 0 4px;"',
  blockquote:
    'style="margin:12px 0 0;padding:10px 14px;border-left:3px solid #e5e7eb;color:#5b616e;background-color:#f8f9fb;border-radius:4px;"',
};
