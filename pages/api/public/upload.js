import formidable from "formidable";
import fs from "fs";
import { createServiceClient } from "../../../lib/supabase/server";
import { analyzeIpa } from "../../../lib/ipaAnalyzer";
import { analyzeAppBinary } from "../../../lib/appAnalyzer";
import { fetchWebAppInfo } from "../../../lib/faviconFetcher";

export const config = {
  api: { bodyParser: false },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The public, no-login "drop a build, get a link" landing page posts here.
// Deliberately unauthenticated (see middleware.js) — an email address and
// the release ID's unguessability are the only gates. Releases created
// here have no project (project_id stays null) and carry uploader_email so
// the uploader can find them again after signing in with that address.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const form = formidable({ maxFileSize: 300 * 1024 * 1024 }); // 300MB ceiling
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    res.status(400).json({ error: "Could not parse upload: " + e.message });
    return;
  }

  const get = (f) => (Array.isArray(fields[f]) ? fields[f][0] : fields[f]);
  const email = (get("email") || "").trim().toLowerCase();
  const platform = get("platform");
  const webUrl = get("webUrl") || null;
  const notes = get("notes") || null;
  const appNameInput = get("appName") || null;

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  if (!["ios", "android", "web"].includes(platform)) {
    res.status(400).json({ error: "Unsupported platform." });
    return;
  }
  if (platform === "web" && !webUrl) {
    res.status(400).json({ error: "App URL is required for web apps." });
    return;
  }

  const service = createServiceClient();
  const uploaded = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

  let filePath = null;
  let buildBuffer = null;

  if (platform !== "web") {
    if (!uploaded) {
      res.status(400).json({ error: "Choose a build file to upload." });
      return;
    }
    buildBuffer = fs.readFileSync(uploaded.filepath);
    filePath = `public/${Date.now()}-${uploaded.originalFilename}`;

    const { error: uploadError } = await service.storage.from("builds").upload(filePath, buildBuffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      res.status(500).json({ error: "Upload failed: " + uploadError.message });
      return;
    }
  }

  let otaReady = null;
  let provisioningInfo = null;
  let appName = appNameInput;
  let appIcon = null;
  let version = null;
  let buildNumber = null;
  let bundleId = null;
  let minOsVersion = null;
  let fileSizeBytes = null;
  let deviceFamily = null;

  if (buildBuffer) {
    if (platform === "ios") {
      try {
        const analysis = analyzeIpa(buildBuffer);
        otaReady = analysis.otaReady;
        provisioningInfo = analysis.provisioning;
      } catch (e) {
        provisioningInfo = { error: e.message };
        otaReady = false;
      }
    }

    const appInfo = await analyzeAppBinary(buildBuffer, platform);
    // The name embedded in the build itself is authoritative for
    // iOS/Android — it's what actually shows on the device after install,
    // so a stray or stale value typed into the form must never override
    // it. Only fall back to user input if extraction found none.
    appName = appInfo.appName || appName;
    appIcon = appInfo.icon;
    version = appInfo.version;
    buildNumber = appInfo.buildNumber;
    bundleId = appInfo.bundleId;
    minOsVersion = appInfo.minOsVersion;
    fileSizeBytes = appInfo.fileSizeBytes;
    deviceFamily = appInfo.deviceFamily;
  }

  if (platform === "web" && webUrl) {
    const webInfo = await fetchWebAppInfo(webUrl);
    appName = appName || webInfo.appName;
    appIcon = webInfo.icon;
  }

  const { data: release, error: insertError } = await service
    .from("releases")
    .insert({
      project_id: null,
      platform,
      version: version || "1.0",
      build_number: buildNumber,
      bundle_id: bundleId,
      notes,
      file_path: filePath,
      web_url: platform === "web" ? webUrl : null,
      ota_ready: otaReady,
      provisioning_info: provisioningInfo,
      app_name: appName,
      app_icon: appIcon,
      min_os_version: minOsVersion,
      file_size_bytes: fileSizeBytes,
      device_family: deviceFamily,
      uploader_email: email,
      status: "published",
      created_by: null,
    })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ releaseId: release.id });
}
