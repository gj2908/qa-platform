import AppInfoParser from "app-info-parser";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Keep release rows lean — icons are typically well under this.
const MAX_ICON_CHARS = 200_000;

const DEVICE_FAMILY_LABELS = { 1: "iPhone", 2: "iPad" };

function isUnresolvedResource(value) {
  return typeof value !== "string" || value === "" || /^resourceid:/i.test(value);
}

// Some APKs' string resources don't resolve cleanly through this library
// (locale/config variants, split APKs, odd resources.arsc layouts) — the
// app label then comes back as undefined or a raw "resourceId:0x..." string
// instead of text. Fall back to the first launcher activity's label, then to
// a best-guess derived from the package name, so the form still has
// something reasonable to prefill instead of leaving it blank.
function resolveAndroidAppName(info) {
  const appLabel = info?.application?.label;
  if (!isUnresolvedResource(appLabel)) return appLabel;

  const launcherLabel = info?.application?.launcherActivities?.[0]?.label;
  if (!isUnresolvedResource(launcherLabel)) return launcherLabel;

  const pkg = info?.package;
  if (typeof pkg === "string" && pkg.includes(".")) {
    const last = pkg.split(".").filter(Boolean).pop();
    if (last) return last.charAt(0).toUpperCase() + last.slice(1);
  }

  return null;
}

// AppInfoParser only accepts a file path in Node, so the buffer (whether it
// came straight off the upload or was downloaded back from storage) gets
// written to a throwaway temp file for the duration of parsing.
export async function analyzeAppBinary(buffer, platform) {
  const result = {
    appName: null,
    bundleId: null,
    version: null,
    buildNumber: null,
    minOsVersion: null,
    deviceFamily: null,
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
      result.version = info.CFBundleShortVersionString || null;
      result.buildNumber = info.CFBundleVersion ? String(info.CFBundleVersion) : null;
      result.minOsVersion = info.MinimumOSVersion ? `iOS ${info.MinimumOSVersion}+` : null;
      if (Array.isArray(info.UIDeviceFamily) && info.UIDeviceFamily.length) {
        result.deviceFamily = info.UIDeviceFamily.map((n) => DEVICE_FAMILY_LABELS[n]).filter(Boolean).join(", ") || null;
      }
    } else {
      result.appName = resolveAndroidAppName(info);
      result.bundleId = info.package || null;
      result.version = info.versionName ? String(info.versionName) : null;
      result.buildNumber = info.versionCode ? String(info.versionCode) : null;
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
