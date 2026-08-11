import formidable from "formidable";
import fs from "fs";
import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { analyzeIpa } from "../../../lib/ipaAnalyzer";
import { analyzeAppBinary } from "../../../lib/appAnalyzer";
import { findDuplicateRelease } from "../../../lib/findDuplicateRelease";
import { fetchWebAppInfo } from "../../../lib/faviconFetcher";
import { sendWebhookNotification, buildReleasePayload } from "../../../lib/webhookNotify";
import { logActivity } from "../../../lib/logActivity";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // Confirm the caller is logged in (reads cookies, doesn't touch the body).
  const authSupabase = createServerSupabase(req, res);
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const form = formidable({ maxFileSize: 500 * 1024 * 1024 }); // 500MB ceiling
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    res.status(400).json({ error: "Could not parse upload: " + e.message });
    return;
  }

  const get = (f) => (Array.isArray(fields[f]) ? fields[f][0] : fields[f]);
  const projectId = get("projectId");
  const platform = get("platform");
  const version = get("version");
  const buildNumber = get("buildNumber") || null;
  const bundleId = get("bundleId") || null;
  const notes = get("notes") || null;
  const webUrl = get("webUrl") || null;
  const appNameInput = get("appName") || null;
  const replace = get("replace") === "true" || get("replace") === "1";

  if (!projectId || !platform || !version) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Publishing a release uses the service role below (it needs to touch
  // storage and run file analysis), which bypasses RLS — so the caller's
  // role has to be checked explicitly here instead of relying on the DB.
  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner" && role !== "editor") {
    res.status(403).json({ error: "You don't have permission to publish releases in this project" });
    return;
  }

  if (platform === "ios" && !bundleId) {
    res.status(400).json({ error: "Bundle ID is required for iOS releases" });
    return;
  }
  if (platform === "web" && !appNameInput) {
    res.status(400).json({ error: "App name is required for web releases" });
    return;
  }

  const service = createServiceClient();
  let filePath = null;

  const uploaded = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;
  const providedFilePath = get("filePath");

  if (platform !== "web") {
    if (uploaded) {
      const buffer = fs.readFileSync(uploaded.filepath);
      filePath = `${projectId}/${Date.now()}-${uploaded.originalFilename}`;

      const { error: uploadError } = await service.storage
        .from("builds")
        .upload(filePath, buffer, {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        res.status(500).json({ error: "Upload failed: " + uploadError.message });
        return;
      }
    } else if (providedFilePath) {
      filePath = providedFilePath;
    } else {
      res.status(400).json({ error: "Build file is required for iOS/Android releases" });
      return;
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
        const { data, error: downloadError } = await service.storage
          .from("builds")
          .download(filePath);
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

  // A build that matches the exact same specifications (same project, same
  // platform, version, build number and bundle identity) is treated as a
  // re-upload of the same app — ask to replace it rather than duplicating it.
  // Scoped to the same project only.
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
    // The build file was just uploaded for this attempt — remove it so the
    // private "builds" bucket doesn't collect an orphaned object.
    if (filePath) {
      await service.storage.from("builds").remove([filePath]);
    }
    res.status(409).json({
      error: "This exact build already exists in this project. Re-upload with replace to overwrite it.",
      duplicate: true,
      releaseId: existing.id,
    });
    return;
  }

  if (existing && replace) {
    if (existing.file_path) {
      await service.storage.from("builds").remove([existing.file_path]);
    }
    const { error: deleteError } = await service
      .from("releases")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }
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
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  await logActivity(service, {
    projectId,
    actorEmail: user.email,
    action: "release_published",
    detail: `${release.platform} v${release.version}${release.build_number ? ` (${release.build_number})` : ""}`,
  });

  // Best-effort release notification — never lets a slow/broken webhook
  // fail or meaningfully delay the response (bounded by the helper's own
  // 5s timeout).
  try {
    const { data: project } = await service
      .from("projects")
      .select("webhook_url")
      .eq("id", projectId)
      .single();
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
    // ignored — notification failures never affect the publish response
  }

  res.status(200).json({ releaseId: release.id });
}
