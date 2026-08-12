import { activateScheduledReleaseIfDue } from "./activateScheduledRelease";

// "What's the current release for this project+channel, per platform?" —
// shared by pages/channel/[projectId]/[channel].js (the stable
// "always latest" tester link) and pages/api/v1/check-update.js (the
// in-app update-check endpoint), so there's exactly one implementation
// of this resolution order:
//   published+scheduled → lazily activate any due-scheduled release →
//   filter to published → latest per platform → overlay channel_pins,
//   ignoring a pin whose release is no longer published.
export async function resolveLatestReleases(service, { projectId, channel, req }) {
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

  return latestByPlatform;
}
