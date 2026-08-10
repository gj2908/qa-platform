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

  const { projectId } = req.body || {};
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const service = createServiceClient();

  // Clean up any uploaded build files so the private "builds" bucket doesn't
  // accumulate orphaned objects once the release rows are cascade-deleted.
  const { data: releases } = await service
    .from("releases")
    .select("file_path")
    .eq("project_id", projectId)
    .not("file_path", "is", null);

  const filePaths = (releases || []).map((r) => r.file_path).filter(Boolean);
  if (filePaths.length > 0) {
    await service.storage.from("builds").remove(filePaths);
  }

  // Delete through the caller's own session so RLS applies — tasks and
  // releases cascade via their project_id foreign keys.
  const { error: deleteError } = await authSupabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
