import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

// Cleans up a build file that was uploaded for the "upload, then prefill"
// flow in the release form but never turned into a release (removed by the
// uploader, or replaced with a different file before publishing).
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

  const { filePath } = req.body || {};
  if (!filePath) {
    res.status(400).json({ error: "Missing filePath" });
    return;
  }

  const service = createServiceClient();
  await service.storage.from("builds").remove([filePath]);

  res.status(200).json({ ok: true });
}
