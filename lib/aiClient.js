// Thin Anthropic Messages API client, mirroring lib/webhookNotify.js's
// AbortController-timeout fetch pattern. Best-effort by design — every
// caller must keep working if ANTHROPIC_API_KEY isn't set or the call
// fails; nothing in this app depends on AI features being available.
const FETCH_TIMEOUT_MS = 15_000;
const MODEL = "claude-haiku-4-5-20251001";

async function callClaude(system, userMessage, maxTokens = 500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `AI request failed (${res.status})` };
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function cleanUpReleaseNotes(rawNotes) {
  const result = await callClaude(
    "You clean up rough release notes for a mobile/web app changelog. Rewrite the user's draft into 2-6 short, tester-friendly bullet points, no headers, no markdown bold, just plain lines starting with '- '. Keep it factual — never invent changes that weren't mentioned. Return only the cleaned notes, nothing else.",
    rawNotes,
    400
  );
  return result;
}

export async function triageFeedback(feedbackText) {
  const result = await callClaude(
    "Classify this tester bug report. Respond with EXACTLY one line in the format: category|severity — where category is one of bug, feature, question and severity is one of low, medium, high. No other text.",
    feedbackText,
    20
  );
  if (!result.ok) return result;

  const match = result.text.trim().match(/^(bug|feature|question)\|(low|medium|high)/i);
  if (!match) return { ok: false, error: "Unexpected AI response" };
  return { ok: true, category: match[1].toLowerCase(), severity: match[2].toLowerCase() };
}
