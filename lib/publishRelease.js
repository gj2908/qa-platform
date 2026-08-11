import fs from "fs";
import { analyzeIpa } from "./ipaAnalyzer";
import { analyzeAppBinary } from "./appAnalyzer";
import { findDuplicateRelease } from "./findDuplicateRelease";
import { fetchWebAppInfo } from "./faviconFetcher";
import { sendWebhookNotification, buildReleasePayload } from "./webhookNotify";
import { logActivity } from "./logActivity";

// Shared by the interactive session-authenticated endpoint
// (pages/api/releases/create.js) and the CI/token-authenticated one
// (pages/api/ci/releases/create.js) — everything downstream of "who is
// this and are they allowed to publish here" is identical either way.
// Returns { ok: true, releaseId } or { ok: false, status, body } shaped
// so callers can pass `body` straight to res.status(status).json(body).
export async function publishRelease({
  service,
  req,
  projectId,
  platform,
  version,
  buildNumber,
  bundleId,
  notes,
  webUrl,
  appNameInput,
  replace,
  files,
  providedFilePath,
  createdByUserId,
  actorEmail,
  activityDetailSuffix = "",
}) {
  if (!projectId || !platform || !version) {
    return { ok: false, status: 400, body: { error: "Missing required fields" } };
  }
  if (platform === "ios" && !bundleId) {
    return { ok: false, status: 400, body: { error: "Bundle ID is required for iOS releases" } };
  }
  if (platform === "web" && !appNameInput) {
    return { ok: false, status: 400, body: { error: "App name is required for web releases" } };
  }

  let filePath = null;
  const uploaded = files?.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

  if (platform !== "web") {
    if (uploaded) {
      const buffer = fs.readFileSync(uploaded.filepath);
      filePath = `${projectId}/${Date.now()}-${uploaded.originalFilename}`;

      const { error: uploadError } = await service.storage
        .from("builds")
        .upload(filePath, buffer, { contentType: "application/octet-stream", upsert: false });

      if (uploadError) {
        return { ok: false, status: 500, body: { error: "Upload failed: " + uploadError.message } };
      }
    } else if (providedFilePath) {
      // The interactive dialog pre-uploads via a signed URL and only
      // passes the resulting storage path here — no file blob in this
      // request at all.
      filePath = providedFilePath;
    } else {
      return { ok: false, status: 400, body: { error: "Build file is required for iOS/Android releases" } };
    }
  }

  let otaReady = null;
  let provisioningInfo = null;
  let appName = appNameInput;
  let appIcon = null;
  let minOsVersion = null;
  let fileSizeBytes = null;
  let detectedBundleId = null;
  let deviceFamily = null;

  if (platform !== "web" && filePath) {
    let buildBuffer = null;
    try {
      if (uploaded) {
        buildBuffer = fs.readFileSync(uploaded.filepath);
      } else {
        const { data, error: downloadError } = await service.storage.from("builds").download(filePath);
        if (!downloadError && data) {
          buildBuffer = Buffer.from(await data.arrayBuffer());
        }
      }
    } catch (e) {
      buildBuffer = null;
    }

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
      appName = appName || appInfo.appName;
      appIcon = appInfo.icon;
      minOsVersion = appInfo.minOsVersion;
      fileSizeBytes = appInfo.fileSizeBytes;
      detectedBundleId = appInfo.bundleId;
      deviceFamily = appInfo.deviceFamily;
    }
  }

  if (platform === "web" && webUrl) {
    const webInfo = await fetchWebAppInfo(webUrl);
    appName = appName || webInfo.appName;
    appIcon = webInfo.icon;
  }

  const resolvedBundleId = bundleId || detectedBundleId;
  const existing = await findDuplicateRelease(service, {
    projectId,
    platform,
    version,
    buildNumber,
    bundleId: platform === "web" ? null : resolvedBundleId,
    webUrl: platform === "web" ? webUrl : null,
  });

  if (existing && !replace) {
    if (filePath) await service.storage.from("builds").remove([filePath]);
    return {
      ok: false,
      status: 409,
      body: {
        error: "This exact build already exists in this project. Re-upload with replace to overwrite it.",
        duplicate: true,
        releaseId: existing.id,
      },
    };
  }

  if (existing && replace) {
    if (existing.file_path) await service.storage.from("builds").remove([existing.file_path]);
    const { error: deleteError } = await service.from("releases").delete().eq("id", existing.id);
    if (deleteError) return { ok: false, status: 500, body: { error: deleteError.message } };
  }

  const { data: release, error: insertError } = await service
    .from("releases")
    .insert({
      project_id: projectId,
      platform,
      version,
      build_number: buildNumber,
      bundle_id: bundleId || detectedBundleId,
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
      status: "published",
      created_by: createdByUserId,
    })
    .select()
    .single();

  if (insertError) {
    return { ok: false, status: 500, body: { error: insertError.message } };
  }

  await logActivity(service, {
    projectId,
    actorEmail,
    action: "release_published",
    detail: `${release.platform} v${release.version}${release.build_number ? ` (${release.build_number})` : ""}${activityDetailSuffix}`,
  });

  // Best-effort release notification — never lets a slow/broken webhook
  // fail or meaningfully delay the response.
  try {
    const { data: project } = await service.from("projects").select("webhook_url").eq("id", projectId).single();
    if (project?.webhook_url) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      await sendWebhookNotification(
        project.webhook_url,
        buildReleasePayload({
          appName: release.app_name,
          version: release.version,
          buildNumber: release.build_number,
          platform: release.platform,
          installUrl: `${protocol}://${host}/distribute/${release.id}`,
        })
      );
    }
  } catch (e) {
    // ignored — notification failures never affect the publish result
  }

  return { ok: true, releaseId: release.id };
}
