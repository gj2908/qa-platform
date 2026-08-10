import Link from "next/link";
import { useState } from "react";
import { createServerSupabase, createServiceClient } from "../../lib/supabase/server";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res); // enforces login via middleware already
  const { data: release } = await supabase
    .from("releases")
    .select("*, projects(name)")
    .eq("id", params.id)
    .single();

  if (!release) return { notFound: true };

  const service = createServiceClient();
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let itmsLink = null;
  let androidUrl = null;

  if (release.platform === "ios") {
    const manifestUrl = `${protocol}://${host}/api/manifest?releaseId=${release.id}`;
    itmsLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  }

  if (release.platform === "android" && release.file_path) {
    const { data: signed } = await service.storage
      .from("builds")
      .createSignedUrl(release.file_path, 3600); // 1 hour, plenty for a manual download
    androidUrl = signed?.signedUrl || null;
  }

  return { props: { release, itmsLink, androidUrl } };
}

const PLATFORM_LABEL = { ios: "iOS", android: "Android", web: "Web" };

export default function Distribute({ release, itmsLink, androidUrl }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${release.id}` : "";

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 460, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
      <div style={{ textAlign: "left", marginBottom: 24 }}>
        <Link href={`/projects/${release.project_id}/changelog`} style={{ fontSize: 14 }}>
          ← {release.projects?.name} changelog
        </Link>
      </div>

      <h1 style={{ marginBottom: 4 }}>{release.projects?.name}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        {PLATFORM_LABEL[release.platform]} · v{release.version}
        {release.build_number ? ` (${release.build_number})` : ""}
      </p>

      {/* IPA signed with a Development provisioning profile — iOS will refuse OTA installs */}
      {release.platform === "ios" && release.ota_ready === false && (
        <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
          <strong>This build can&apos;t be installed over the air</strong>
          <p style={{ margin: "8px 0 0" }}>
            The uploaded IPA is signed with a {release.provisioning_info?.type?.toLowerCase?.() === "development" ? "Development" : "non-distribution"} profile
            {release.provisioning_info?.name ? ` (${release.provisioning_info.name})` : ""}. iOS only allows OTA installs for{" "}
            <strong>Ad&nbsp;Hoc</strong> or <strong>Enterprise</strong> signed builds. Rebuild with Xcode →{" "}
            <strong>Distribute → Ad&nbsp;Hoc</strong> and upload the new IPA.
          </p>
        </div>
      )}

      <div style={{ margin: "28px 0" }}>
        {release.platform === "ios" && (
          <a
            href={itmsLink}
            style={{ display: "inline-block", padding: "14px 28px", background: "#111", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}
          >
            Install
          </a>
        )}
        {release.platform === "android" && androidUrl && (
          <a
            href={androidUrl}
            style={{ display: "inline-block", padding: "14px 28px", background: "#3ddc84", color: "#111", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}
          >
            Install
          </a>
        )}
        {release.platform === "web" && release.web_url && (
          <a
            href={release.web_url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", padding: "14px 28px", background: "#111", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}
          >
            Open app
          </a>
        )}
      </div>

      {release.platform === "ios" && (
        <p style={{ fontSize: 12, color: "#999" }}>
          Requires this device's UDID to be registered in the app's provisioning profile.
        </p>
      )}
      {release.platform === "android" && (
        <p style={{ fontSize: 12, color: "#999" }}>
          Downloads the APK — you may need to allow installs from unknown sources.
        </p>
      )}

      {release.notes && (
        <div style={{ textAlign: "left", marginTop: 32, borderTop: "1px solid #eee", paddingTop: 20 }}>
          <h3 style={{ fontSize: 14, color: "#555" }}>Release notes</h3>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{release.notes}</p>
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 20 }}>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>
          Public link — anyone with it can view and install, no login required.
        </p>
        <button
          onClick={copyLink}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fafafa", fontSize: 13 }}
        >
          {copied ? "Copied!" : "Copy public share link"}
        </button>
      </div>
    </div>
  );
}
