import { useEffect, useState } from "react";
import { createServiceClient } from "../../lib/supabase/server";
import { detectEnv, safariRedirectUrl } from "../../lib/browserDetect";

export async function getServerSideProps({ params, req }) {
  const supabase = createServiceClient();
  const { data: release } = await supabase
    .from("releases")
    .select("*, projects(name)")
    .eq("id", params.id)
    .eq("status", "published")
    .single();

  if (!release) return { notFound: true };

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let itmsLink = null;
  let androidUrl = null;

  if (release.platform === "ios") {
    const manifestUrl = `${protocol}://${host}/api/manifest?releaseId=${release.id}`;
    itmsLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  }

  if (release.platform === "android" && release.file_path) {
    const { data: signed } = await supabase.storage
      .from("builds")
      .createSignedUrl(release.file_path, 86400); // 24h — public link, testers may not click right away
    androidUrl = signed?.signedUrl || null;
  }

  return { props: { release, itmsLink, androidUrl } };
}

const PLATFORM_LABEL = { ios: "iOS", android: "Android", web: "Web" };

export default function SharePage({ release, itmsLink, androidUrl }) {
  const [env, setEnv] = useState(null);

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  const showInstallButton =
    release.platform !== "ios" || !env || (env.isSafari && !env.isNonSafariIOSBrowser);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 460, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 4 }}>{release.projects?.name}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        {PLATFORM_LABEL[release.platform]} · v{release.version}
        {release.build_number ? ` (${release.build_number})` : ""}
      </p>

      {/* Non-Safari browser on iOS (Chrome, Firefox, Edge, in-app webviews) —
          itms-services links are unreliable outside Safari, so redirect. */}
      {env?.isNonSafariIOSBrowser && release.platform === "ios" && (
        <div style={{ background: "#fff4e5", border: "1px solid #ffdca8", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
          <strong>Open this in Safari to install</strong>
          <p style={{ margin: "8px 0" }}>
            iOS only allows app installs from Safari. Tap below to reopen this page there.
          </p>
          <a
            href={safariRedirectUrl()}
            style={{ display: "inline-block", padding: "10px 18px", background: "#111", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
          >
            Open in Safari
          </a>
          <p style={{ margin: "10px 0 0", color: "#886" }}>
            If nothing happens, tap the <strong>⋯</strong> or share icon in your browser's toolbar and choose <strong>Open in Safari</strong>.
          </p>
        </div>
      )}

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

      {/* iPad in "Request Desktop Website" mode — same page, just steer them
          back to mobile mode since desktop mode can interfere with the
          install handoff. */}
      {env?.isDesktopModeIPad && release.platform === "ios" && (
        <div style={{ background: "#eef4ff", border: "1px solid #c8dcff", borderRadius: 10, padding: 16, margin: "20px 0", fontSize: 14, textAlign: "left" }}>
          <strong>Switch to mobile site to install</strong>
          <p style={{ margin: "8px 0 0" }}>
            This page is loading in Desktop Site mode. In Safari, tap the{" "}
            <strong>ᴀᴀ</strong> icon in the address bar → <strong>Request Mobile Website</strong>, then tap Install again.
          </p>
        </div>
      )}

      <div style={{ margin: "28px 0" }}>
        {release.platform === "ios" && showInstallButton && (
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
    </div>
  );
}
