import Link from "next/link";
import { createServiceClient } from "../../../lib/supabase/server";
import { activateScheduledReleaseIfDue } from "../../../lib/activateScheduledRelease";
import Logo from "../../../components/layout/Logo";
import ThemeToggle from "../../../components/ThemeToggle";
import Card from "../../../components/ui/Card";
import { PLATFORM_META } from "../../../components/ui/PlatformBadge";

const CHANNELS = ["internal", "beta", "production"];

// A stable "always the latest" link per project+channel — testers
// bookmark this instead of hunting the changelog for the newest build.
// Resolves to the single current release for a platform and hands off
// to /share/[id], which already owns all expiry/PIN/rollout gating —
// this page never duplicates that logic.
export async function getServerSideProps({ params, req }) {
  const { projectId, channel } = params;
  if (!CHANNELS.includes(channel)) return { notFound: true };

  const supabase = createServiceClient();
  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).single();
  if (!project) return { notFound: true };

  const { data: candidates } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", projectId)
    .eq("channel", channel)
    .in("status", ["published", "scheduled"])
    .order("created_at", { ascending: false });

  const activated = await Promise.all(
    (candidates || []).map((r) => (r.status === "scheduled" ? activateScheduledReleaseIfDue(supabase, r, req) : r))
  );
  const published = activated.filter((r) => r.status === "published");

  const latestByPlatform = {};
  for (const r of published) {
    if (!latestByPlatform[r.platform]) latestByPlatform[r.platform] = r;
  }

  // A pin (see channel_pins / changelog.js's "Pin to channel") overrides
  // "latest published" for whichever platform it targets — if the pinned
  // release has since been deleted or unpublished, it's simply ignored
  // and that platform falls back to latest, no error state needed.
  const { data: pins } = await supabase
    .from("channel_pins")
    .select("platform, release_id")
    .eq("project_id", projectId)
    .eq("channel", channel);
  for (const pin of pins || []) {
    const pinnedRelease = published.find((r) => r.id === pin.release_id);
    if (pinnedRelease) latestByPlatform[pin.platform] = pinnedRelease;
  }

  const releases = Object.values(latestByPlatform);

  if (releases.length === 0) return { notFound: true };
  if (releases.length === 1) {
    return { redirect: { destination: `/share/${releases[0].id}`, permanent: false } };
  }

  return {
    props: {
      projectName: project.name,
      channel,
      releases: releases.map((r) => ({ id: r.id, platform: r.platform, version: r.version, build_number: r.build_number })),
    },
  };
}

export default function ChannelPicker({ projectName, channel, releases }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo compact />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">
          <Card className="flex flex-col gap-4 p-6">
            <div>
              <h1 className="text-lg font-semibold text-ink-primary">{projectName}</h1>
              <p className="mt-1 text-sm capitalize text-ink-tertiary">{channel} channel — choose a platform</p>
            </div>
            <div className="flex flex-col gap-2">
              {releases.map((r) => {
                const meta = PLATFORM_META[r.platform];
                const Icon = meta.icon;
                return (
                  <Link
                    key={r.id}
                    href={`/share/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3.5 py-3 transition-colors hover:bg-hover"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} strokeWidth={2} className="text-ink-tertiary" />
                      <span className="text-sm font-medium text-ink-primary">{meta.label}</span>
                    </div>
                    <span className="text-xs text-ink-tertiary">
                      v{r.version}
                      {r.build_number ? ` (${r.build_number})` : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
