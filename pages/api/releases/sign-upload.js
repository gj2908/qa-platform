import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

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

  const { projectId, platform, filename } = req.body || {};
  if (!projectId || !platform || !filename || platform === "web") {
    res.status(400).json({ error: "projectId, platform and filename are required (web does not upload)" });
    return;
  }

  const safeName = String(filename).replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const filePath = `${projectId}/${Date.now()}-${safeName}`;

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from("builds")
    .createSignedUploadUrl(filePath, 3600);

  if (error) {
    res.status(500).json({ error: "Could not create upload URL: " + error.message });
    return;
  }

  res.status(200).json({ uploadUrl: data.signedUrl, filePath: data.path });
}
