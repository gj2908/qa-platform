import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { analyzeAppBinary } from "../../../lib/appAnalyzer";
import { fetchWebAppInfo } from "../../../lib/faviconFetcher";

// Read-only preview: extracts app details from an already-uploaded build
// (or a web app's homepage) so the release form can prefill itself, without
// creating a release row. The actual values still get re-derived in
// /api/releases/create — this endpoint only powers the form's autofill.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { platform, filePath, webUrl } = req.body || {};

  if (platform === "web") {
    if (!webUrl) {
      res.status(400).json({ error: "Missing webUrl" });
      return;
    }
    const info = await fetchWebAppInfo(webUrl);
    res.status(200).json({ appName: info.appName, icon: info.icon });
    return;
  }

  if (platform !== "ios" && platform !== "android") {
    res.status(400).json({ error: "Unsupported platform" });
    return;
  }
  if (!filePath) {
    res.status(400).json({ error: "Missing filePath" });
    return;
  }

  const service = createServiceClient();
  const { data, error: downloadError } = await service.storage.from("builds").download(filePath);
  if (downloadError || !data) {
    res.status(404).json({ error: "Could not read the uploaded build" });
    return;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const info = await analyzeAppBinary(buffer, platform);
  res.status(200).json(info);
}
