import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";

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
    .select("file_path, project_id, uploader_email, platform, version, build_number")
    .eq("id", releaseId)
    .single();

  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }

  // Everything below (storage removal) uses the service role, which
  // bypasses RLS — so permission has to be checked explicitly here first,
  // not just left to the DB delete.
  let authorized = false;
  if (release.project_id) {
    const { data: role } = await authSupabase.rpc("project_role", { p_project_id: release.project_id });
    authorized = role === "owner" || role === "editor";
  } else {
    authorized = release.uploader_email === user.email;
  }
  if (!authorized) {
    res.status(403).json({ error: "You don't have permission to delete this release" });
    return;
  }

  if (release?.file_path) {
    await service.storage.from("builds").remove([release.file_path]);
  }

  // Delete through the caller's own session so RLS applies.
  const { error: deleteError } = await authSupabase.from("releases").delete().eq("id", releaseId);

  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  if (release.project_id) {
    await logActivity(service, {
      projectId: release.project_id,
      actorEmail: user.email,
      action: "release_deleted",
      detail: `${release.platform} v${release.version}${release.build_number ? ` (${release.build_number})` : ""}`,
    });
  }

  res.status(200).json({ ok: true });
}
