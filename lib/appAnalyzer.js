import AppInfoParser from "app-info-parser";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Keep release rows lean — icons are typically well under this.
const MAX_ICON_CHARS = 200_000;

// AppInfoParser only accepts a file path in Node, so the buffer (whether it
// came straight off the upload or was downloaded back from storage) gets
// written to a throwaway temp file for the duration of parsing.
export async function analyzeAppBinary(buffer, platform) {
  const result = {
    appName: null,
    bundleId: null,
    minOsVersion: null,
    icon: null,
    fileSizeBytes: buffer?.length || null,
  };
  if (!buffer || !buffer.length) return result;
  if (platform !== "ios" && platform !== "android") return result;

  const ext = platform === "ios" ? "ipa" : "apk";
  const tmpPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.${ext}`);

  try {
    fs.writeFileSync(tmpPath, buffer);
    const parser = new AppInfoParser(tmpPath);
    const info = await parser.parse();

    if (platform === "ios") {
      result.appName = info.CFBundleDisplayName || info.CFBundleName || null;
      result.bundleId = info.CFBundleIdentifier || null;
      result.minOsVersion = info.MinimumOSVersion ? `iOS ${info.MinimumOSVersion}+` : null;
    } else {
      const label = info.application?.label;
      result.appName = typeof label === "string" && !/^resourceid:/i.test(label) ? label : null;
      result.bundleId = info.package || null;
      const minSdk = info.usesSdk?.minSdkVersion;
      result.minOsVersion = minSdk ? `Android SDK ${minSdk}+` : null;
    }

    if (typeof info.icon === "string" && info.icon.startsWith("data:") && info.icon.length <= MAX_ICON_CHARS) {
      result.icon = info.icon;
    }
  } catch (e) {
    // Best-effort — missing details just mean the install page falls back
    // to whatever the uploader typed in the release form.
  } finally {
    fs.unlink(tmpPath, () => {});
  }

  return result;
}
