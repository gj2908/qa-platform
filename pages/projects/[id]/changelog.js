import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import PlatformBadge from "../../../components/ui/PlatformBadge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import AppIcon from "../../../components/release/AppIcon";
import NewReleaseDialog from "../../../components/release/NewReleaseDialog";
import Input from "../../../components/ui/Input";
import { useToast } from "../../../components/ui/ToastProvider";
import {
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  ExternalLink,
  Rocket,
  Search,
  ShieldCheck,
  TriangleAlert,
  CircleAlert,
  Trash2,
  X,
} from "lucide-react";
import { relativeTime } from "../../../lib/format";
import { PLATFORM_META } from "../../../components/ui/PlatformBadge";
import { canManageReleases, isOwner } from "../../../components/ui/role";
import { getExpiryStatus } from "../../../lib/provisioning";
import { activateScheduledReleaseIfDue } from "../../../lib/activateScheduledRelease";
import { createServiceClient } from "../../../lib/supabase/server";

const PLATFORM_ORDER = ["ios", "android", "web"];

function groupReleasesByPlatform(releases) {
  const groups = {};
  for (const r of releases) {
    (groups[r.platform] ||= []).push(r);
  }
  return PLATFORM_ORDER.filter((p) => groups[p]?.length).map((platform) => ({
    platform,
    releases: groups[platform],
  }));
}

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });

  // Activate any scheduled releases whose time has come before rendering,
  // same lazy-activation approach used on the public pages.
  const { data: dueScheduled } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString());
  if (dueScheduled?.length) {
    const service = createServiceClient();
    await Promise.all(dueScheduled.map((r) => activateScheduledReleaseIfDue(service, r, req)));
  }

  const { data: releases } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const { data: scheduled } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true });

  const { data: pending } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  return {
    props: {
      project,
      role,
      releases: releases || [],
      scheduled: scheduled || [],
      pending: pending || [],
    },
  };
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

function ExpiryBadge({ release }) {
  if (release.platform !== "ios") return null;
  const expiry = getExpiryStatus(release.provisioning_info);
  if (!expiry || expiry.status === "ok") return null;

  if (expiry.status === "expired") {
    return (
      <Badge tone="danger" icon={CalendarClock}>
        Profile expired
      </Badge>
    );
  }
  return (
    <Badge tone="warning" icon={CalendarClock}>
      Expires in {expiry.daysLeft} day{expiry.daysLeft === 1 ? "" : "s"}
    </Badge>
  );
}

function StatusBadges({ release }) {
  const expiry = release.platform === "ios" ? getExpiryStatus(release.provisioning_info) : null;
  const info = release.provisioning_info;
  const hasSigningBadge =
    release.platform === "ios" &&
    (info?.type === "Enterprise" ||
      info?.type === "Development" ||
      info?.type === "Ad Hoc" ||
      (!info?.type && release.ota_ready === false));
  const hasExpiryBadge = expiry && expiry.status !== "ok";
  if (!hasSigningBadge && !hasExpiryBadge) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SigningBadge release={release} />
      <ExpiryBadge release={release} />
    </div>
  );
}

function ChangelogRow({ release, onDelete, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = release.notes && release.notes.length > 180;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <AppIcon src={release.app_icon} fallbackLabel={release.app_name} size={28} />
          <PlatformBadge platform={release.platform} />
          <span className="text-sm font-semibold text-ink-primary">
            v{release.version}
            {release.build_number ? ` (${release.build_number})` : ""}
          </span>
          <span className="text-xs text-ink-tertiary">{relativeTime(release.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/distribute/${release.id}`}>
            <Button size="sm" variant="secondary">
              <ExternalLink size={13} strokeWidth={2.25} />
              Install page
            </Button>
          </Link>
          {canEdit && (
            <button
              onClick={() => onDelete(release)}
              title="Delete release"
              className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>

      <StatusBadges release={release} />

      {release.notes && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
            Build notes
          </h4>
          <p
            className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary ${
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

function PendingApprovalSection({ pending, onDecided }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  async function decide(release, action) {
    setBusyId(release.id);
    const res = await fetch("/api/releases/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId: release.id, action }),
    });
    setBusyId(null);
    if (res.ok) {
      toast.success(action === "approve" ? "Release approved and published." : "Release rejected.");
      onDecided();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't process that release.");
    }
  }

  if (pending.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Clock size={14} strokeWidth={2.25} className="text-warning" />
        <h2 className="text-sm font-semibold text-ink-primary">Pending approval</h2>
        <span className="rounded-full border border-border bg-subtle px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
          {pending.length}
        </span>
      </div>
      <div className="divide-y divide-border rounded-lg border border-warning/40 bg-warning-subtle/40">
        {pending.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <AppIcon src={r.app_icon} fallbackLabel={r.app_name} size={28} />
              <PlatformBadge platform={r.platform} />
              <span className="text-sm font-semibold text-ink-primary">
                v{r.version}
                {r.build_number ? ` (${r.build_number})` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" loading={busyId === r.id} onClick={() => decide(r, "approve")}>
                <Check size={13} strokeWidth={2.25} />
                Approve
              </Button>
              <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => decide(r, "reject")}>
                <X size={13} strokeWidth={2.25} />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduledSection({ scheduled }) {
  if (scheduled.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Clock size={14} strokeWidth={2.25} className="text-ink-tertiary" />
        <h2 className="text-sm font-semibold text-ink-primary">Scheduled</h2>
        <span className="rounded-full border border-border bg-subtle px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
          {scheduled.length}
        </span>
      </div>
      <div className="divide-y divide-border rounded-lg border border-dashed border-border">
        {scheduled.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <AppIcon src={r.app_icon} fallbackLabel={r.app_name} size={28} />
              <PlatformBadge platform={r.platform} />
              <span className="text-sm font-semibold text-ink-primary">
                v{r.version}
                {r.build_number ? ` (${r.build_number})` : ""}
              </span>
            </div>
            <span className="text-xs text-ink-tertiary">
              Publishes {new Date(r.scheduled_for).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Changelog({ project, role, releases, scheduled, pending }) {
  const router = useRouter();
  const canEdit = canManageReleases(role);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState(null);

  const filteredReleases = releases.filter((r) => {
    if (platformFilter && r.platform !== platformFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (r.app_name || "").toLowerCase().includes(q) ||
      r.version.toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q)
    );
  });

  // Deep-link support (e.g. the dashboard's "Release" quick link) — opens
  // the New release dialog right away instead of requiring an extra click.
  useEffect(() => {
    if (router.query.new === "1" && canEdit) setDialogOpen(true);
  }, [router.query.new, canEdit]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch("/api/releases/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId: deleteTarget.id }),
    });
    setDeleting(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || "Couldn't delete this release.");
      setDeleteTarget(null);
    }
  }

  return (
    <ProjectShell project={project} active="changelog">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Changelog</h1>
            <p className="mt-1 text-sm text-ink-tertiary">Published releases for {project.name}.</p>
          </div>
          {canEdit && (
            <Button onClick={() => setDialogOpen(true)}>
              <Rocket size={15} strokeWidth={2.25} />
              New release
            </Button>
          )}
        </div>

        {deleteError && (
          <p className="rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            {deleteError}
          </p>
        )}

        {isOwner(role) && <PendingApprovalSection pending={pending} onDecided={() => router.replace(router.asPath)} />}
        {canEdit && <ScheduledSection scheduled={scheduled} />}

        {releases.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={14} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <Input
                placeholder="Search version, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPlatformFilter(null)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  !platformFilter ? "bg-accent-subtle text-accent-subtle-fg" : "text-ink-tertiary hover:bg-hover"
                }`}
              >
                All
              </button>
              {PLATFORM_ORDER.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    platformFilter === p ? "bg-accent-subtle text-accent-subtle-fg" : "text-ink-tertiary hover:bg-hover"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {releases.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No releases yet"
            description={
              canEdit
                ? "Publish your first build to see it show up here."
                : "Nothing has been published to this project yet."
            }
            action={
              canEdit && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Rocket size={15} strokeWidth={2.25} />
                  New release
                </Button>
              )
            }
          />
        ) : filteredReleases.length === 0 ? (
          <EmptyState icon={Search} title="No matches" description="Try a different search or filter." />
        ) : (
          <div className="flex flex-col gap-6">
            {groupReleasesByPlatform(filteredReleases).map(({ platform, releases: group }) => {
              const meta = PLATFORM_META[platform];
              const Icon = meta.icon;
              return (
                <div key={platform}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Icon size={14} strokeWidth={2.25} className="text-ink-tertiary" />
                    <h2 className="text-sm font-semibold text-ink-primary">{meta.label} builds</h2>
                    <span className="rounded-full border border-border bg-subtle px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
                      {group.length}
                    </span>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                    {group.map((r) => (
                      <ChangelogRow key={r.id} release={r} onDelete={setDeleteTarget} canEdit={canEdit} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete v${deleteTarget?.version}${deleteTarget?.build_number ? ` (${deleteTarget.build_number})` : ""}?`}
        description="This permanently removes the release and its uploaded build file. Its install and share links will stop working. This can't be undone."
        confirmLabel="Delete release"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
  );
}
