// Stable 0-99 bucket for a caller-supplied device identifier — the
// check-update API has no cookie jar (native device code, not a
// browser), so it can't reuse shareGating.js's cookie-based bucket.
export function bucketForDeviceId(deviceId) {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}
