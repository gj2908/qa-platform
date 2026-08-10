// Finds a release in the same project that matches the exact same
// specifications: platform, version, build number and bundle/URL identity.
// Matching is scoped to a single project on purpose — the same app uploaded
// to a different project is NOT treated as a duplicate.
export async function findDuplicateRelease(
  service,
  { projectId, platform, version, buildNumber, bundleId, webUrl }
) {
  if (!projectId || !platform || !version) return null;

  let q = service
    .from("releases")
    .select("id, version, build_number, bundle_id, web_url, app_name, file_path, created_at")
    .eq("project_id", projectId)
    .eq("platform", platform)
    .eq("version", version);

  q = buildNumber ? q.eq("build_number", buildNumber) : q.is("build_number", null);

  if (platform === "web") {
    q = webUrl ? q.eq("web_url", webUrl) : q.is("web_url", null);
  } else {
    q = bundleId ? q.eq("bundle_id", bundleId) : q.is("bundle_id", null);
  }

  const { data } = await q.limit(1).maybeSingle();
  return data || null;
}
