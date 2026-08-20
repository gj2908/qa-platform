import { createServiceClient } from "../../../lib/supabase/server";
import { checkRateLimit, clientIp } from "../../../lib/rateLimit";

// Returns a short-lived signed upload URL for a feedback screenshot,
// scoped to one published release's path — the browser uploads directly
// to Storage from here (never through this server), same two-step
// pattern as pages/api/releases/sign-upload.js's authenticated
// equivalent. Deliberately unauthenticated (see middleware.js's
// isPublicUploadApi exemption), same trust model as report-issue.js
// itself, so it shares that endpoint's rate limit budget.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { releaseId } = req.body || {};
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

  const { data: release } = await service.from("releases").select("id").eq("id", releaseId).eq("status", "published").single();
  if (!release) {
    res.status(404).json({ error: "Release not found." });
    return;
  }

  const filePath = `${releaseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { data, error } = await service.storage.from("feedback").createSignedUploadUrl(filePath);
  if (error) {
    res.status(500).json({ error: "Could not create upload URL: " + error.message });
    return;
  }

  res.status(200).json({ uploadUrl: data.signedUrl, filePath: data.path });
}
