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
  channel = "production",
  scheduledFor = null,
  publisherRole = "owner",
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
      // Same sanitization as the interactive upload path
      // (pages/api/releases/sign-upload.js) — an unsanitized CI filename
      // (spaces, unicode, path-like characters) could otherwise produce a
      // broken storage key.
      const safeName = String(uploaded.originalFilename).replace(/[^\w.\- ]/g, "_").slice(0, 120);
      filePath = `${projectId}/${Date.now()}-${safeName}`;

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
    if (uploaded) {
      try {
        buildBuffer = fs.readFileSync(uploaded.filepath);
      } catch (e) {
        buildBuffer = null;
      }
    } else {
      // providedFilePath means the interactive dialog uploaded the build
      // directly from the browser via a signed URL — this download is the
      // only server-side confirmation that upload actually succeeded. A
      // missing/failed object here must hard-fail the publish rather than
      // silently skip metadata extraction and continue on to "published"
      // with a file_path that points at nothing.
      const { data, error: downloadError } = await service.storage.from("builds").download(filePath);
      if (downloadError || !data) {
        return {
          ok: false,
          status: 400,
          body: { error: "Uploaded build file was not found in storage. Please re-upload and try again." },
        };
      }
      buildBuffer = Buffer.from(await data.arrayBuffer());
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
      // The name embedded in the build itself is authoritative for
      // iOS/Android — it's what actually shows on the device after
      // install, so a stray or stale value typed into the form must never
      // override it. Only fall back to user input if extraction found none.
      appName = appInfo.appName || appName;
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

  const { data: project } = await service
    .from("projects")
    .select("webhook_url, require_approval")
    .eq("id", projectId)
    .single();

  // Precedence: an explicit future schedule always wins; otherwise a
  // non-owner publish into an approval-required project lands as
  // pending_review; otherwise it publishes immediately as before.
  const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();
  const needsApproval = !isScheduled && project?.require_approval && publisherRole !== "owner";
  const status = isScheduled ? "scheduled" : needsApproval ? "pending_review" : "published";

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
      channel,
      scheduled_for: scheduledFor || null,
      status,
      created_by: createdByUserId,
    })
    .select()
    .single();

  if (insertError) {
    return { ok: false, status: 500, body: { error: insertError.message } };
  }

  // Scheduled/pending-review releases fire activity + webhook later, at
  // the moment they actually activate (lib/activateScheduledRelease.js
  // for scheduling; pages/api/releases/approve.js for approval).
  if (status !== "published") {
    return { ok: true, releaseId: release.id, status };
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
        }),
        { service, projectId, event: "release_published" }
      );
    }
  } catch (e) {
    // ignored — notification failures never affect the publish result
  }

  return { ok: true, releaseId: release.id, status };
}
