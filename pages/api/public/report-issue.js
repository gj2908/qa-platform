import { createServiceClient } from "../../../lib/supabase/server";

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

  const { releaseId, feedback, reporterEmail } = req.body || {};

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

  const title = trimmedFeedback.length > 80 ? `${trimmedFeedback.slice(0, 77)}...` : trimmedFeedback;
  const buildLabel = `${release.app_name || "Build"} v${release.version}${
    release.build_number ? ` (${release.build_number})` : ""
  } — ${release.platform}`;
  const description = `${trimmedFeedback}\n\n— Reported by ${
    email || "anonymous"
  } on ${buildLabel} (release ${release.id})`;

  const { error: insertError } = await service.from("tasks").insert({
    project_id: release.project_id,
    title,
    description,
    status: "backlog",
    created_by: null,
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
