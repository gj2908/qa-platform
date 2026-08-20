import { activateScheduledReleaseIfDue } from "./activateScheduledRelease";
import { bucketForDeviceId } from "./deviceBucket";

// "What's the current release for this project+channel, per platform?" —
// shared by pages/channel/[projectId]/[channel].js (the stable
// "always latest" tester link) and pages/api/v1/check-update.js (the
// in-app update-check endpoint), so there's exactly one implementation
// of this resolution order:
//   published+scheduled → lazily activate any due-scheduled release →
//   filter to published → latest per platform → overlay channel_pins,
//   ignoring a pin whose release is no longer published → staged
//   rollout: a deviceId not yet in a release's rollout_percent falls
//   back to the previous published release on that platform.
export async function resolveLatestReleases(service, { projectId, channel, req, deviceId }) {
  const { data: candidates } = await service
    .from("releases")
    .select("*")
    .eq("project_id", projectId)
    .eq("channel", channel)
    .in("status", ["published", "scheduled"])
    .order("created_at", { ascending: false });

  const activated = await Promise.all(
    (candidates || []).map((r) => (r.status === "scheduled" ? activateScheduledReleaseIfDue(service, r, req) : r))
  );
  const published = activated.filter((r) => r.status === "published");

  const latestByPlatform = {};
  for (const r of published) {
    if (!latestByPlatform[r.platform]) latestByPlatform[r.platform] = r;
  }

  const { data: pins } = await service
    .from("channel_pins")
    .select("platform, release_id")
    .eq("project_id", projectId)
    .eq("channel", channel);
  for (const pin of pins || []) {
    const pinnedRelease = published.find((r) => r.id === pin.release_id);
    if (pinnedRelease) latestByPlatform[pin.platform] = pinnedRelease;
  }

  // Staged rollout: a device not yet in a release's rollout_percent sees
  // the previous published release on this channel instead, so a canary
  // rollout can ramp gradually without needing an explicit "old" pin.
  // No deviceId supplied (existing callers) means unchanged behavior.
  if (deviceId) {
    const bucket = bucketForDeviceId(deviceId);
    for (const platform of Object.keys(latestByPlatform)) {
      const release = latestByPlatform[platform];
      if (release.rollout_percent == null || bucket < release.rollout_percent) continue;
      const previous = published.find((r) => r.platform === platform && r.id !== release.id);
      if (previous) latestByPlatform[platform] = previous;
    }
  }

  return latestByPlatform;
}
