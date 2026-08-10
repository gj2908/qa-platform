import { createServiceClient } from "../../lib/supabase/server";

// Intentionally NOT behind the login gate (see middleware.js) — Apple's
// itms-services installer fetches this directly from the device, without
// browser auth cookies. The releaseId is an unguessable UUID, and the
// signed file URL it embeds expires in 5 minutes.
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

  const { data: signed, error: signError } = await supabase.storage
    .from("builds")
    .createSignedUrl(release.file_path, 300); // 5 minutes

  if (signError) {
    res.status(500).send("Could not sign file URL: " + signError.message);
    return;
  }

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
          <string>${signed.signedUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${release.bundle_id}</string>
        <key>bundle-version</key>
        <string>${release.version}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${release.notes ? release.notes.split("\n")[0].slice(0, 60) : "App"}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(plist);
}
