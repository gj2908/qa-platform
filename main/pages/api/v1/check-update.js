import { createServiceClient } from "../../../lib/supabase/server";
import { verifyApiToken } from "../../../lib/verifyApiToken";
import { resolveLatestReleases } from "../../../lib/resolveLatestRelease";
import { compareVersions } from "../../../lib/compareVersions";

const PLATFORMS = ["ios", "android", "web"];

// GET /api/v1/check-update — lets a running app (distributed through
// this platform) ask "is there something newer than what I have?".
// Bearer-token authenticated like the rest of /api/v1/*; the token's
// project scope plus the caller's platform/channel/currentVersion decide
// the answer. See pages/docs/api.js for the client-integration example.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const service = createServiceClient();
  const token = await verifyApiToken(service, req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization: Bearer <token> header" });
    return;
  }

  const platform = req.query.platform;
  const channel = req.query.channel || "production";
  const currentVersion = req.query.currentVersion;
  const currentBuildNumber = req.query.currentBuildNumber || null;
  const deviceId = req.query.deviceId || null;

  if (!PLATFORMS.includes(platform)) {
    res.status(400).json({ error: "platform must be one of: ios, android, web" });
    return;
  }
  if (!currentVersion) {
    res.status(400).json({ error: "currentVersion is required" });
    return;
  }

  const latestByPlatform = await resolveLatestReleases(service, {
    projectId: token.project_id,
    channel,
    req,
    deviceId,
  });
  const release = latestByPlatform[platform];

  if (!release) {
    res.status(200).json({ updateAvailable: false });
    return;
  }

  const versionCmp = compareVersions(release.version, currentVersion);
  const buildCmp =
    versionCmp === 0 && currentBuildNumber
      ? compareVersions(release.build_number || "0", currentBuildNumber)
      : 0;
  const updateAvailable = versionCmp > 0 || buildCmp > 0;

  if (!updateAvailable) {
    res.status(200).json({ updateAvailable: false });
    return;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  let updateUrl;
  if (release.platform === "ios") {
    const manifestUrl = `${origin}/api/manifest?releaseId=${release.id}`;
    updateUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  } else if (release.platform === "android") {
    updateUrl = `${origin}/api/download/${release.id}`;
  } else {
    updateUrl = release.web_url;
  }

  res.status(200).json({
    updateAvailable: true,
    latestVersion: release.version,
    latestBuildNumber: release.build_number,
    notes: release.notes,
    updateUrl,
  });
}
