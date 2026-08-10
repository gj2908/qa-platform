import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { findDuplicateRelease } from "../../../lib/findDuplicateRelease";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { projectId, platform, version, buildNumber, bundleId, webUrl } = req.body || {};
  if (!projectId || !platform || !version) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const service = createServiceClient();
  const existing = await findDuplicateRelease(service, {
    projectId,
    platform,
    version,
    buildNumber: buildNumber || null,
    bundleId: bundleId || null,
    webUrl: webUrl || null,
  });

  if (!existing) {
    res.status(200).json({ duplicate: false });
    return;
  }

  res.status(200).json({
    duplicate: true,
    release: {
      id: existing.id,
      appName: existing.app_name,
      version: existing.version,
      buildNumber: existing.build_number,
      createdAt: existing.created_at,
    },
  });
}
