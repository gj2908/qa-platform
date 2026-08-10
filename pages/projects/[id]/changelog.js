import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import PlatformBadge from "../../../components/ui/PlatformBadge";
import { ClipboardList, ExternalLink, Rocket, ShieldCheck, TriangleAlert, CircleAlert } from "lucide-react";
import { relativeTime } from "../../../lib/format";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  const { data: releases } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (!project) return { notFound: true };
  return { props: { project, releases: releases || [] } };
}

function SigningBadge({ release }) {
  if (release.platform !== "ios") return null;
  const info = release.provisioning_info;
  if (info?.type === "Enterprise") {
    return (
      <Badge tone="success" icon={ShieldCheck}>
        Enterprise — installs on any device
      </Badge>
    );
  }
  if (info?.type === "Development" || info?.type === "Ad Hoc") {
    return (
      <Badge tone="warning" icon={TriangleAlert}>
        {info.type} — {info.deviceCount} registered device{info.deviceCount === 1 ? "" : "s"}
      </Badge>
    );
  }
  if (!info?.type && release.ota_ready === false) {
    return (
      <Badge tone="danger" icon={CircleAlert}>
        Signing couldn&apos;t be verified for OTA
      </Badge>
    );
  }
  return null;
}

function ChangelogRow({ release }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = release.notes && release.notes.length > 180;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <PlatformBadge platform={release.platform} />
          <span className="text-sm font-semibold text-ink-primary">
            v{release.version}
            {release.build_number ? ` (${release.build_number})` : ""}
          </span>
          <span className="text-xs text-ink-tertiary">{relativeTime(release.created_at)}</span>
        </div>
        <Link href={`/distribute/${release.id}`}>
          <Button size="sm" variant="secondary">
            <ExternalLink size={13} strokeWidth={2.25} />
            Install page
          </Button>
        </Link>
      </div>

      <SigningBadge release={release} />

      {release.notes && (
        <div>
          <p
            className={`whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary ${
              !expanded && isLong ? "line-clamp-2" : ""
            }`}
          >
            {release.notes}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-xs font-medium text-accent hover:text-accent-hover"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Changelog({ project, releases }) {
  return (
    <AppShell
      project={project}
      breadcrumbs={[{ label: "Projects", href: "/" }, { label: project.name }, { label: "Changelog" }]}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Changelog</h1>
            <p className="mt-1 text-sm text-ink-tertiary">Published releases for {project.name}.</p>
          </div>
          <Link href={`/projects/${project.id}/new-release`}>
            <Button>
              <Rocket size={15} strokeWidth={2.25} />
              New release
            </Button>
          </Link>
        </div>

        {releases.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No releases yet"
            description="Publish your first build to see it show up here."
            action={
              <Link href={`/projects/${project.id}/new-release`}>
                <Button>
                  <Rocket size={15} strokeWidth={2.25} />
                  New release
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {releases.map((r) => (
              <ChangelogRow key={r.id} release={r} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
