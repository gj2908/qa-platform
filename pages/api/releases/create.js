import formidable from "formidable";
import fs from "fs";
import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { analyzeIpa } from "../../../lib/ipaAnalyzer";

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

  if (!projectId || !platform || !version) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (platform === "ios" && !bundleId) {
    res.status(400).json({ error: "Bundle ID is required for iOS releases" });
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
  if (platform === "ios" && filePath) {
    try {
      let ipaBuffer = null;
      if (uploaded) {
        ipaBuffer = fs.readFileSync(uploaded.filepath);
      } else {
        const { data, error: downloadError } = await service.storage
          .from("builds")
          .download(filePath);
        if (!downloadError && data) {
          ipaBuffer = Buffer.from(await data.arrayBuffer());
        }
      }
      if (ipaBuffer) {
        const analysis = analyzeIpa(ipaBuffer);
        otaReady = analysis.otaReady;
        provisioningInfo = analysis.provisioning;
      }
    } catch (e) {
      provisioningInfo = { error: e.message };
      otaReady = false;
    }
  }

  const { data: release, error: insertError } = await service
    .from("releases")
    .insert({
      project_id: projectId,
      platform,
      version,
      build_number: buildNumber,
      bundle_id: bundleId,
      notes,
      file_path: filePath,
      web_url: platform === "web" ? webUrl : null,
      ota_ready: otaReady,
      provisioning_info: provisioningInfo,
      status: "published",
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ releaseId: release.id });
}
