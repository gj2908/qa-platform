import { createHash } from "crypto";
import { createServiceClient } from "../../../lib/supabase/server";
import { checkRateLimit, clientIp } from "../../../lib/rateLimit";

const MAX_STACK_LENGTH = 20000;
const MAX_MESSAGE_LENGTH = 2000;

// Crash reports from apps distributed through this platform — same
// unauthenticated, releaseId-scoped trust model as
// pages/api/public/report-issue.js (a release id is unguessable, and
// anyone who could report from inside the app already installed it).
// MVP scope: stores the raw exception/stack trace and groups reports by
// a simple signature — no automatic symbolication (dSYM/ProGuard mapping
// upload + address resolution isn't realistically buildable on Vercel's
// serverless runtime; see main/CLAUDE.md).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { releaseId, exceptionType, message, stackTrace, deviceModel, osVersion } = req.body || {};

  if (typeof releaseId !== "string" || !releaseId) {
    res.status(400).json({ error: "Missing releaseId." });
    return;
  }
  const trimmedType = typeof exceptionType === "string" ? exceptionType.trim() : "";
  if (!trimmedType) {
    res.status(400).json({ error: "exceptionType is required." });
    return;
  }

  const service = createServiceClient();

  const rate = await checkRateLimit(service, `crash-report:${clientIp(req)}`, {
    maxAttempts: 60,
    windowMinutes: 60,
    settingsKeyPrefix: "crash_report",
  });
  if (!rate.allowed) {
    res.status(429).json({ error: "Too many crash reports from this connection. Please try again later." });
    return;
  }

  const { data: release } = await service
    .from("releases")
    .select("id, project_id, platform, version, build_number")
    .eq("id", releaseId)
    .single();

  if (!release) {
    res.status(404).json({ error: "Release not found." });
    return;
  }
  if (!release.project_id) {
    res.status(400).json({ error: "This build has no project to report to." });
    return;
  }

  const trimmedStack = typeof stackTrace === "string" ? stackTrace.slice(0, MAX_STACK_LENGTH) : null;
  const trimmedMessage = typeof message === "string" ? message.slice(0, MAX_MESSAGE_LENGTH) : null;

  // Grouping key: exception type + the stack trace's first line. Not real
  // fingerprinting (stack formats vary too much across iOS/Android/JS to
  // reliably pick "the top frame" generically), but stable and good
  // enough to dedup the same crash happening repeatedly.
  const firstLine = (trimmedStack || "").split("\n")[0] || "";
  const signature = createHash("sha256").update(`${trimmedType}|${firstLine}`).digest("hex").slice(0, 16);

  const { error } = await service.from("crash_reports").insert({
    project_id: release.project_id,
    release_id: release.id,
    platform: release.platform,
    app_version: release.version,
    build_number: release.build_number,
    exception_type: trimmedType,
    message: trimmedMessage,
    stack_trace: trimmedStack,
    device_model: typeof deviceModel === "string" ? deviceModel.slice(0, 200) : null,
    os_version: typeof osVersion === "string" ? osVersion.slice(0, 50) : null,
    signature,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
