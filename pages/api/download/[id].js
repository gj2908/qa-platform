import { createServiceClient } from "../../../lib/supabase/server";

// Redirect-through endpoint for Android/web installs, so a real install
// attempt can be counted server-side before handing off to the actual
// file/site — mirrors what pages/api/manifest.js already does for iOS.
// Intentionally NOT behind the login gate (see middleware.js's static
// matcher exclusion) — hit anonymously from the public share page.
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    res.status(400).send("Missing release id");
    return;
  }

  const supabase = createServiceClient();
  const { data: release } = await supabase
    .from("releases")
    .select("platform, file_path, web_url, project_id")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!release) {
    res.status(404).send("Release not found");
    return;
  }

  let targetUrl = null;
  if (release.platform === "android" && release.file_path) {
    const { data: publicFile } = supabase.storage.from("builds").getPublicUrl(release.file_path);
    targetUrl = publicFile.publicUrl || null;
  } else if (release.platform === "web" && release.web_url) {
    targetUrl = release.web_url;
  }

  if (!targetUrl) {
    res.status(404).send("Nothing to download for this release");
    return;
  }

  await supabase.rpc("increment_install_count", { p_release_id: id });
  if (release.project_id) {
    await supabase
      .from("install_events")
      .insert({ release_id: id, project_id: release.project_id, platform: release.platform });
  }

  res.redirect(302, targetUrl);
}
