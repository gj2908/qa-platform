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
    const { data: publicFile } = service.storage.from("builds").getPublicUrl(release.file_path);
    androidUrl = publicFile.publicUrl || null;
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

      {/* IPA signing status — explains what OTA install depends on */}
      {release.platform === "ios" && release.provisioning_info?.type === "Enterprise" && (
        <div style={{ background: "#eef7ee", border: "1px solid #bcdcc2", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
          <strong>Enterprise-signed — installs on any iPhone</strong>
          <p style={{ margin: "8px 0 0" }}>
            This build is signed for in-house distribution, so no UDID registration is needed. Just tap Install.
          </p>
        </div>
      )}
      {release.platform === "ios" &&
        (release.provisioning_info?.type === "Development" || release.provisioning_info?.type === "Ad Hoc") && (
          <div style={{ background: "#fff8e1", border: "1px solid #f0dfa8", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
            <strong>Signed for registered devices only</strong>
            <p style={{ margin: "8px 0 0" }}>
              This build uses a {release.provisioning_info.type} profile{" "}
              {release.provisioning_info.name ? `(${release.provisioning_info.name})` : ""} with{" "}
              {release.provisioning_info.deviceCount} registered device
              {release.provisioning_info.deviceCount === 1 ? "" : "s"}. It will only install on an iPhone whose
              UDID is in that profile — if a tester gets &quot;Unable to Download App&quot;, that device isn&apos;t
              registered yet.
            </p>
          </div>
        )}
      {release.platform === "ios" &&
        !release.provisioning_info?.type &&
        release.ota_ready === false && (
          <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
            <strong>Signing couldn&apos;t be verified for OTA install</strong>
            <p style={{ margin: "8px 0 0" }}>
              iOS could not be verified to accept this build over the air
              {release.provisioning_info?.error ? ` (${release.provisioning_info.error})` : ""}. Rebuild with an
              Ad&nbsp;Hoc or Enterprise profile in Xcode and re-upload.
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
