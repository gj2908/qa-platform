import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import StatTile from "../../../components/ui/StatTile";
import ExpandableList from "../../../components/ui/ExpandableList";
import PlatformBadge from "../../../components/ui/PlatformBadge";
import AppIcon from "../../../components/release/AppIcon";
import NewReleaseDialog from "../../../components/release/NewReleaseDialog";
import { ROLE_META, canManageReleases, isOwner } from "../../../components/ui/role";
import { STATUS_META, STATUS_ORDER } from "../../../components/ui/status";
import { relativeTime, shortDate } from "../../../lib/format";
import {
  Kanban,
  ClipboardList,
  ListTodo,
  PackageCheck,
  Plus,
  Rocket,
  Users,
  Clock,
  Download as DownloadIcon,
  Smartphone,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Filter,
  Settings,
} from "lucide-react";
import { activityMetaFor } from "../../../lib/activityMeta";
import BarChart from "../../../components/ui/BarChart";
import Avatar from "../../../components/ui/Avatar";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });

  const { data: tasks } = await supabase.from("tasks").select("status").eq("project_id", params.id);
  const { data: releases } = await supabase
    .from("releases")
    .select("id, platform, version, build_number, created_at, app_name, app_icon")
    .eq("project_id", params.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: collaboratorsRaw } = await supabase
    .from("project_collaborators")
    .select("email, role")
    .eq("project_id", params.id);
  const { data: activityRaw } = await supabase
    .from("project_activity")
    .select("id, actor_email, action, detail, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  let collaborators = collaboratorsRaw || [];
  let activity = activityRaw || [];

  const emails = [...new Set([...collaborators.map((c) => c.email), ...activity.map((a) => a.actor_email)])];
  if (emails.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("email, full_name, avatar_url").in("email", emails);
    const profileByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p]));
    collaborators = collaborators.map((c) => ({
      ...c,
      full_name: profileByEmail[c.email]?.full_name || null,
      avatar_url: profileByEmail[c.email]?.avatar_url || null,
    }));
    activity = activity.map((a) => ({ ...a, actor_name: profileByEmail[a.actor_email]?.full_name || null }));
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: installEventsRaw } = await supabase
    .from("install_events")
    .select("created_at, releases(version)")
    .eq("project_id", params.id)
    .gte("created_at", since);
  const installEvents = installEventsRaw || [];

  const dayBuckets = {};
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    dayBuckets[day] = 0;
  }
  const versionBuckets = {};
  for (const e of installEvents) {
    const day = e.created_at.slice(0, 10);
    if (day in dayBuckets) dayBuckets[day] += 1;
    const version = e.releases?.version || "unknown";
    versionBuckets[version] = (versionBuckets[version] || 0) + 1;
  }
  const installTrend = Object.entries(dayBuckets).map(([label, value]) => ({ label, value }));
  const versionAdoption = Object.entries(versionBuckets)
    .map(([version, count]) => ({ version, count, pct: Math.round((count / Math.max(installEvents.length, 1)) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // "Completed this week" + velocity chart — done tasks bucketed by
  // updated_at (there's no dedicated completed_at column, so this is an
  // approximation: retitling/relabeling a done task also bumps
  // updated_at, nudging which week it's counted in — see the caption in
  // the UI). Bucketed the same pre-seed-then-walk-once way installTrend
  // buckets by day above, just with 7-day-wide, 6-bucket periods instead
  // of 30 one-day periods.
  const { data: doneTasksRaw } = await supabase
    .from("tasks")
    .select("id, updated_at")
    .eq("project_id", params.id)
    .eq("status", "done");
  const doneTasks = doneTasksRaw || [];

  const now = Date.now();
  const completedThisWeek = doneTasks.filter((t) => now - new Date(t.updated_at).getTime() < 7 * 86_400_000).length;

  const weekBuckets = {};
  const weekLabels = [];
  for (let i = 5; i >= 0; i--) {
    const label = new Date(now - i * 7 * 86_400_000).toISOString().slice(0, 10);
    weekBuckets[label] = 0;
    weekLabels.push(label);
  }
  for (const t of doneTasks) {
    const ageWeeks = Math.floor((now - new Date(t.updated_at).getTime()) / (7 * 86_400_000));
    const label = weekLabels[5 - ageWeeks];
    if (label in weekBuckets) weekBuckets[label] += 1;
  }
  const velocity = Object.entries(weekBuckets).map(([label, value]) => ({ label, value }));

  // Funnel (share page view → install click) + device/OS breakdown, last
  // 30 days — page_view_events has the more reliable UA data (a real
  // browser hit), install_events covers the "installed" stage.
  const { data: pageViewsRaw } = await supabase
    .from("page_view_events")
    .select("os_name, device_model, created_at")
    .eq("project_id", params.id)
    .gte("created_at", since);
  const pageViews = pageViewsRaw || [];
  const funnel = [
    { label: "Viewed", value: pageViews.length },
    { label: "Installed", value: installEvents.length },
  ];
  const osBuckets = {};
  for (const v of pageViews) {
    const label = v.os_name || "Unknown";
    osBuckets[label] = (osBuckets[label] || 0) + 1;
  }
  const deviceBreakdown = Object.entries(osBuckets)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Feedback-analytics: tester-reported tasks, open vs. resolved.
  const { data: feedbackTasks } = await supabase
    .from("tasks")
    .select("status")
    .eq("project_id", params.id)
    .eq("source", "tester_feedback");
  const feedbackStats = {
    total: feedbackTasks?.length || 0,
    open: (feedbackTasks || []).filter((t) => t.status !== "done").length,
    resolved: (feedbackTasks || []).filter((t) => t.status === "done").length,
  };

  return {
    props: {
      project,
      installTrend,
      versionAdoption,
      funnel,
      deviceBreakdown,
      feedbackStats,
      completedThisWeek,
      velocity,
      role,
      tasks: tasks || [],
      releases: releases || [],
      collaborators,
      activity,
    },
  };
}

export default function ProjectOverview({
  project,
  role,
  tasks,
  releases,
  collaborators,
  activity,
  installTrend,
  versionAdoption,
  funnel,
  deviceBreakdown,
  feedbackStats,
  completedThisWeek,
  velocity,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canEdit = canManageReleases(role);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const roleMeta = ROLE_META[role];

  return (
    <ProjectShell project={project} active="overview" role={role}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-primary">{project.name}</h1>
              {roleMeta && (
                <span className="flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-ink-tertiary">
                  <roleMeta.icon size={11} strokeWidth={2.25} />
                  {roleMeta.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-tertiary">
              Created {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner(role) && (
              <Link href={`/projects/${project.id}/settings`}>
                <Button variant="secondary">
                  <Settings size={15} strokeWidth={2.25} />
                  Settings
                </Button>
              </Link>
            )}
            {canEdit && (
              <Button onClick={() => setDialogOpen(true)}>
                <Rocket size={15} strokeWidth={2.25} />
                New release
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={ListTodo} label="Open tasks" value={openTasks} />
          <StatTile icon={CheckCircle2} label="Completed this week" value={completedThisWeek} />
          <StatTile icon={PackageCheck} label="Releases" value={releases.length} />
          <StatTile icon={Users} label="Collaborators" value={collaborators.length} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink-primary">Recent releases</h2>
              <Link
                href={`/projects/${project.id}/changelog`}
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                View changelog
              </Link>
            </div>
            {releases.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 border-dashed py-10 text-center">
                <ClipboardList size={18} className="text-ink-disabled" strokeWidth={1.75} />
                <p className="text-sm text-ink-tertiary">No releases published yet.</p>
              </Card>
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {releases.map((r) => (
                  <Link
                    key={r.id}
                    href={`/distribute/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AppIcon src={r.app_icon} fallbackLabel={r.app_name} size={28} />
                      <PlatformBadge platform={r.platform} />
                      <span className="truncate text-sm font-medium text-ink-primary">
                        v{r.version}
                        {r.build_number ? ` (${r.build_number})` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-ink-tertiary">{relativeTime(r.created_at)}</span>
                  </Link>
                ))}
              </Card>
            )}

            <div className="flex items-center justify-between px-1 pt-2">
              <h2 className="text-sm font-semibold text-ink-primary">Board</h2>
              <Link
                href={`/projects/${project.id}/board`}
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                Open board
              </Link>
            </div>
            <Card className="p-4">
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((key) => {
                  const meta = STATUS_META[key];
                  const count = tasks.filter((t) => t.status === key).length;
                  return (
                    <span
                      key={key}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${meta.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label} · {count}
                    </span>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-ink-secondary">Velocity, last 6 weeks</p>
                <div className="mt-2">
                  <BarChart data={velocity} height={56} formatLabel={shortDate} />
                </div>
                <p className="mt-1 text-[11px] text-ink-tertiary">
                  Based on each task's last-updated time, not a dedicated completion date.
                </p>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink-primary">Team</h2>
              <Link
                href={`/projects/${project.id}/collaborators`}
                className="text-xs font-medium text-accent hover:text-accent-hover"
              >
                Manage
              </Link>
            </div>
            <Card className="overflow-hidden">
              <ExpandableList
                items={collaborators}
                visibleCount={5}
                className="divide-y divide-border"
                toggleClassName="block w-full border-t border-border px-4 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-hover hover:text-accent-hover"
                renderItem={(c) => {
                  const meta = ROLE_META[c.role];
                  const displayName = c.full_name || c.email;
                  return (
                    <div key={c.email} className="flex items-center gap-2.5 px-4 py-2.5">
                      <Avatar avatarUrl={c.avatar_url} seed={c.email} displayName={displayName} size="team" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink-primary">{displayName}</p>
                        <p className="text-[11px] text-ink-tertiary">{meta.label}</p>
                      </div>
                    </div>
                  );
                }}
              />
            </Card>

            <div className="flex flex-col gap-2 pt-2">
              <Link href={`/projects/${project.id}/board`}>
                <Button variant="secondary" className="w-full justify-start">
                  <Kanban size={14} strokeWidth={2} />
                  Open board
                </Button>
              </Link>
              <Link href={`/projects/${project.id}/changelog`}>
                <Button variant="secondary" className="w-full justify-start">
                  <ClipboardList size={14} strokeWidth={2} />
                  View changelog
                </Button>
              </Link>
              <a href={`/register-device/${project.id}`} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full justify-start">
                  <Smartphone size={14} strokeWidth={2} />
                  Device registration link
                </Button>
              </a>
              <a href="/docs/api" target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full justify-start">
                  <BookOpen size={14} strokeWidth={2} />
                  Documentation
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AdoptionCard installTrend={installTrend} versionAdoption={versionAdoption} />
          <FunnelFeedbackCard funnel={funnel} deviceBreakdown={deviceBreakdown} feedbackStats={feedbackStats} />
        </div>

        {activity.length > 0 && <ActivityCard activity={activity} projectId={project.id} isOwner={isOwner(role)} />}
      </div>

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
  );
}

function AdoptionCard({ installTrend, versionAdoption }) {
  const totalInstalls = installTrend.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card>
      <Card.Header>
        <div>
          <Card.Title>Adoption</Card.Title>
          <Card.Description>Installs and version spread, last 30 days</Card.Description>
        </div>
        <TrendingUp size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-tertiary" />
      </Card.Header>
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-xs font-medium text-ink-secondary">
            Installs <span className="text-ink-tertiary">· {totalInstalls} total</span>
          </p>
          <div className="mt-2">
            <BarChart data={installTrend} height={80} formatLabel={shortDate} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">Version adoption</p>
          {versionAdoption.length === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">Not enough data yet.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {versionAdoption.map((v) => (
                <div key={v.version} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 truncate text-ink-secondary">v{v.version}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${v.pct}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-ink-tertiary">{v.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function FunnelFeedbackCard({ funnel, deviceBreakdown, feedbackStats }) {
  const funnelTotal = Math.max(funnel[0]?.value || 0, 1);
  return (
    <Card>
      <Card.Header>
        <div>
          <Card.Title>Funnel & feedback</Card.Title>
          <Card.Description>From share-page view to install, last 30 days</Card.Description>
        </div>
        <Filter size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-tertiary" />
      </Card.Header>
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-xs font-medium text-ink-secondary">Install funnel</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {funnel.map((f) => {
              const pct = Math.round((f.value / funnelTotal) * 100);
              return (
                <div key={f.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 truncate text-ink-secondary">{f.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-ink-tertiary">{f.value}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-secondary">Device/OS</p>
          {deviceBreakdown.length === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">Not enough data yet.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {deviceBreakdown.map((d) => {
                const total = deviceBreakdown.reduce((sum, x) => sum + x.value, 0);
                const pct = Math.round((d.value / Math.max(total, 1)) * 100);
                return (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 truncate text-ink-secondary">{d.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-ink-tertiary">{d.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {feedbackStats.total > 0 && (
          <div className="flex items-center gap-4 border-t border-border pt-4 text-xs text-ink-tertiary">
            <span>
              <span className="font-semibold text-ink-primary">{feedbackStats.total}</span> tester reports
            </span>
            <span>
              <span className="font-semibold text-ink-primary">{feedbackStats.open}</span> open
            </span>
            <span>
              <span className="font-semibold text-ink-primary">{feedbackStats.resolved}</span> resolved
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ActivityCard({ activity, projectId, isOwner: canExport }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <h2 className="text-sm font-semibold text-ink-primary">Recent activity</h2>
        </div>
        {canExport && (
          <a href={`/api/projects/activity-export?projectId=${projectId}`}>
            <Button variant="secondary" size="sm">
              <DownloadIcon size={13} strokeWidth={2.25} />
              Export CSV
            </Button>
          </a>
        )}
      </div>
      <ExpandableList
        items={activity}
        visibleCount={5}
        className="mt-4 flex flex-col gap-3.5"
        renderItem={(a) => {
          const meta = activityMetaFor(a.action);
          const Icon = meta.icon;
          const displayName = a.actor_name || a.actor_email;
          return (
            <div key={a.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                <Icon size={12} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-primary">
                  <span className="font-medium">{displayName}</span> {meta.label}
                  {a.detail ? <span className="text-ink-tertiary"> — {a.detail}</span> : null}
                </p>
                <p className="text-xs text-ink-tertiary">{relativeTime(a.created_at)}</p>
              </div>
            </div>
          );
        }}
      />
    </Card>
  );
}
