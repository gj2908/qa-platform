import { createServiceClient } from "../../lib/supabase/server";

function escapeXml(str) {
  return String(str).replace(/[&<>'"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

// Intentionally NOT behind the login gate (see middleware.js) — Apple's
// itms-services installer fetches this directly from the device, without
// browser auth cookies. The releaseId is an unguessable UUID. The bucket is
// public so the software-package URL has NO query-string token — iOS OTA
// installs are unreliable when the .ipa URL carries query parameters
// (Supabase signed URLs / AWS presigned URLs trigger "Unable to Download App").
export default async function handler(req, res) {
  const { releaseId } = req.query;
  if (!releaseId) {
    res.status(400).send("Missing releaseId");
    return;
  }

  const supabase = createServiceClient();
  const { data: release, error } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .single();

  if (error || !release || release.platform !== "ios" || !release.file_path) {
    res.status(404).send("Release not found");
    return;
  }

  const { data: publicFile } = supabase.storage
    .from("builds")
    .getPublicUrl(release.file_path);

  const fileUrl = publicFile.publicUrl;

  // Shown on iOS's native "Install App" confirmation popup alongside the
  // title below — without these, that system dialog falls back to a
  // generic gray icon.
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const iconUrl = release.app_icon ? `${protocol}://${host}/api/release-icon/${release.id}` : null;
  const iconAssets = iconUrl
    ? `
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${escapeXml(iconUrl)}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>full-size-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${escapeXml(iconUrl)}</string>
        </dict>`
    : "";

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${fileUrl}</string>
        </dict>${iconAssets}
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${escapeXml(release.bundle_id)}</string>
        <key>bundle-version</key>
        <string>${escapeXml(release.version)}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${escapeXml(
          release.app_name || (release.notes ? release.notes.split("\n")[0].slice(0, 60) : "App")
        )}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(plist);
}
