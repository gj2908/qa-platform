import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

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

  const { releaseId } = req.body || {};
  if (!releaseId) {
    res.status(400).json({ error: "Missing releaseId" });
    return;
  }

  const service = createServiceClient();
  const { data: release } = await service
    .from("releases")
    .select("file_path")
    .eq("id", releaseId)
    .single();

  if (release?.file_path) {
    await service.storage.from("builds").remove([release.file_path]);
  }

  // Delete through the caller's own session so RLS applies.
  const { error: deleteError } = await authSupabase.from("releases").delete().eq("id", releaseId);

  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
