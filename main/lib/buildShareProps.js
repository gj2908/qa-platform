// Shared between pages/share/[id].js's getServerSideProps and
// pages/api/public/verify-pin.js's unlock response — both need to turn a
// release row into the same {itmsLink, otherVersions} shape.
export async function buildShareProps(supabase, release, req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let itmsLink = null;
  if (release.platform === "ios") {
    const manifestUrl = `${protocol}://${host}/api/manifest?releaseId=${release.id}`;
    itmsLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  }

  let otherVersions = [];
  if (release.project_id) {
    const { data } = await supabase
      .from("releases")
      .select("id, platform, version, build_number, created_at, notes")
      .eq("project_id", release.project_id)
      .eq("status", "published")
      .neq("id", release.id)
      .order("created_at", { ascending: false })
      .limit(10);
    otherVersions = data || [];
  }

  return { itmsLink, otherVersions };
}
