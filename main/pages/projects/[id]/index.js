import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import ExpandableList from "../../../components/ui/ExpandableList";
import PlatformBadge from "../../../components/ui/PlatformBadge";
import AppIcon from "../../../components/release/AppIcon";
import NewReleaseDialog from "../../../components/release/NewReleaseDialog";
import { ROLE_META, canManageReleases, isOwner } from "../../../components/ui/role";
import { STATUS_META, STATUS_ORDER } from "../../../components/ui/status";
import { relativeTime } from "../../../lib/format";
import {
  Kanban,
  ClipboardList,
  ListTodo,
  PackageCheck,
  Plus,
  Rocket,
  Users,
  Webhook,
  Clock,
  ShieldCheck,
  Download as DownloadIcon,
  Smartphone,
  Mail,
  Building2,
  BookOpen,
  Scale,
  CheckCircle2,
  Map,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../../../components/ui/ToastProvider";
import { activityMetaFor } from "../../../lib/activityMeta";
import BarChart from "../../../components/ui/BarChart";
import { TrendingUp } from "lucide-react";
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

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("id, event, status, response_status, error, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(5);

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

  // Orgs the caller admins — populates the "move to organization" select
  // on OrgAssignmentCard. Only shown to project owners, so no extra
  // gating needed here beyond the query itself.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminOrgMemberships } = user?.email
    ? await supabase.from("org_members").select("org_id").eq("email", user.email).eq("role", "org_admin")
    : { data: [] };
  const adminOrgIds = (adminOrgMemberships || []).map((m) => m.org_id);
  let myOrgs = [];
  if (adminOrgIds.length > 0) {
    const { data } = await supabase.from("organizations").select("id, name").in("id", adminOrgIds).order("name");
    myOrgs = data || [];
  }

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
      deliveries: deliveries || [],
      role,
      tasks: tasks || [],
      releases: releases || [],
      collaborators,
      activity,
      myOrgs,
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
  myOrgs,
  installTrend,
  versionAdoption,
  funnel,
  deviceBreakdown,
  feedbackStats,
  completedThisWeek,
  velocity,
  deliveries,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canEdit = canManageReleases(role);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const roleMeta = ROLE_META[role];

  return (
    <ProjectShell project={project} active="overview">
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
          {canEdit && (
            <Button onClick={() => setDialogOpen(true)}>
              <Rocket size={15} strokeWidth={2.25} />
              New release
            </Button>
          )}
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
            <Card className="flex flex-wrap gap-2 p-4">
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
            <Card className="divide-y divide-border overflow-hidden">
              {collaborators.map((c) => {
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
              })}
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

        <InsightsCard
          installTrend={installTrend}
          versionAdoption={versionAdoption}
          funnel={funnel}
          deviceBreakdown={deviceBreakdown}
          feedbackStats={feedbackStats}
          velocity={velocity}
        />

        {activity.length > 0 && <ActivityCard activity={activity} projectId={project.id} isOwner={isOwner(role)} />}

        {isOwner(role) && <RoadmapCard project={project} />}
        {isOwner(role) && <ApprovalSettingsCard project={project} />}
        {isOwner(role) && <LegalHoldCard project={project} />}
        {isOwner(role) && <WebhookCard project={project} deliveries={deliveries} />}
        {isOwner(role) && <DigestCard project={project} />}
        {isOwner(role) && <ReleaseEmailCard project={project} />}
        {isOwner(role) && <OrgAssignmentCard project={project} myOrgs={myOrgs} />}
      </div>

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
  );
}

function InsightsCard({ installTrend, versionAdoption, funnel, deviceBreakdown, feedbackStats, velocity }) {
  const totalInstalls = installTrend.reduce((sum, d) => sum + d.value, 0);
  const funnelTotal = Math.max(funnel[0]?.value || 0, 1);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Insights</h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-ink-secondary">
            Installs, last 30 days <span className="text-ink-tertiary">· {totalInstalls} total</span>
          </p>
          <div className="mt-2">
            <BarChart data={installTrend} height={80} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-secondary">Velocity (last 6 weeks)</p>
          <div className="mt-2">
            <BarChart data={velocity} height={80} />
          </div>
          <p className="mt-1 text-[11px] text-ink-tertiary">
            Based on each task's last-updated time, not a dedicated completion date — retitling or relabeling a
            done task can nudge which week it's counted in.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-secondary">Version adoption (last 30 days)</p>
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

        <div>
          <p className="text-xs font-medium text-ink-secondary">Install funnel (last 30 days)</p>
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
          <p className="text-xs font-medium text-ink-secondary">Device/OS (last 30 days)</p>
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
      </div>

      {feedbackStats.total > 0 && (
        <div className="mt-5 flex items-center gap-4 border-t border-border pt-4 text-xs text-ink-tertiary">
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

function ApprovalSettingsCard({ project }) {
  const toast = useToast();
  const [requireApproval, setRequireApproval] = useState(project.require_approval);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !requireApproval;
    setSaving(true);
    const res = await fetch("/api/projects/require-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, requireApproval: next }),
    });
    setSaving(false);
    if (res.ok) {
      setRequireApproval(next);
      toast.success(next ? "Approval required for editor publishes." : "Approval requirement removed.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Require approval to publish</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Editors' releases wait for an owner's approval before going out; owner publishes are unaffected.
            </p>
          </div>
        </div>
        <Button variant={requireApproval ? "primary" : "secondary"} size="sm" loading={saving} onClick={toggle}>
          {requireApproval ? "On" : "Off"}
        </Button>
      </div>
    </Card>
  );
}

function RoadmapCard({ project }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(project.roadmap_enabled);
  const [token, setToken] = useState(project.roadmap_token);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/roadmap/${token}` : "";

  async function callRoadmapToggle(body) {
    const res = await fetch("/api/projects/roadmap-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't update the roadmap link.");
      return null;
    }
    return data;
  }

  async function toggle() {
    const next = !enabled;
    setToggling(true);
    const data = await callRoadmapToggle({ enabled: next });
    setToggling(false);
    if (!data) return;
    setEnabled(data.roadmapEnabled);
    toast.success(next ? "Public roadmap enabled." : "Public roadmap disabled.");
  }

  async function regenerate() {
    setRegenerating(true);
    const data = await callRoadmapToggle({ regenerate: true });
    setRegenerating(false);
    setConfirmingRegen(false);
    if (!data) return;
    setToken(data.roadmapToken);
    toast.success("Roadmap link regenerated — the old link no longer works.");
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied.");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Map size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Public roadmap</h2>
        {enabled && <Badge tone="success">Enabled</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        A read-only, no-login page showing this project's To Do, In Progress, and Review tasks —
        titles, priority, labels, and due dates only. No descriptions, assignees, or other internal
        data.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {enabled && (
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button type="button" variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
              {copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button variant={enabled ? "secondary" : "primary"} size="sm" loading={toggling} onClick={toggle} className="w-fit">
            {enabled ? "Disable roadmap" : "Enable roadmap"}
          </Button>
          {enabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRegen(true)}
              className="w-fit"
            >
              <RefreshCw size={13} strokeWidth={2.25} />
              Regenerate link
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRegen}
        title="Regenerate roadmap link?"
        description="The current link stops working immediately — anyone you've already shared it with will need the new one."
        confirmLabel="Regenerate"
        loading={regenerating}
        onConfirm={regenerate}
        onCancel={() => setConfirmingRegen(false)}
      />
    </Card>
  );
}

function LegalHoldCard({ project }) {
  const toast = useToast();
  const [legalHold, setLegalHold] = useState(project.legal_hold);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !legalHold;
    setSaving(true);
    const res = await fetch("/api/projects/legal-hold-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, legalHold: next }),
    });
    setSaving(false);
    if (res.ok) {
      setLegalHold(next);
      toast.success(next ? "Project placed under legal hold." : "Legal hold removed.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Legal hold</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              While on, this project can't be deleted by anyone — enforced at the database level, not just this button.
            </p>
          </div>
        </div>
        <Button variant={legalHold ? "primary" : "secondary"} size="sm" loading={saving} onClick={toggle}>
          {legalHold ? "On" : "Off"}
        </Button>
      </div>
    </Card>
  );
}

function DigestCard({ project }) {
  const toast = useToast();
  const [digestEnabled, setDigestEnabled] = useState(project.digest_enabled);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function toggle() {
    const next = !digestEnabled;
    setSaving(true);
    const res = await fetch("/api/projects/digest-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, digestEnabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setDigestEnabled(next);
      toast.success(next ? "Daily digest enabled." : "Daily digest disabled.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  async function sendTest() {
    setSending(true);
    const res = await fetch("/api/projects/send-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    setSending(false);
    if (res.ok) {
      toast.success("Test digest sent to your email.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't send a test digest — is email configured?");
    }
  }

  return (
    <Card className="p-5" data-testid="digest-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Daily email digest</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              A daily summary of new feedback, releases, pending approvals, and expiring profiles, sent to every
              collaborator.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" loading={sending} onClick={sendTest}>
            Send test
          </Button>
          <Button variant={digestEnabled ? "primary" : "secondary"} size="sm" loading={saving} onClick={toggle}>
            {digestEnabled ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReleaseEmailCard({ project }) {
  const toast = useToast();
  const [releaseEmailsEnabled, setReleaseEmailsEnabled] = useState(project.release_emails_enabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !releaseEmailsEnabled;
    setSaving(true);
    const res = await fetch("/api/projects/release-emails-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, releaseEmailsEnabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setReleaseEmailsEnabled(next);
      toast.success(next ? "Release emails enabled." : "Release emails disabled.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Release publish emails</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Email every collaborator the moment a new release is published — separate from the daily digest.
            </p>
          </div>
        </div>
        <Button variant={releaseEmailsEnabled ? "primary" : "secondary"} size="sm" loading={saving} onClick={toggle}>
          {releaseEmailsEnabled ? "On" : "Off"}
        </Button>
      </div>
    </Card>
  );
}

function OrgAssignmentCard({ project, myOrgs }) {
  const toast = useToast();
  const [orgId, setOrgId] = useState(project.org_id || "");
  const [saving, setSaving] = useState(false);

  async function save(nextOrgId) {
    setSaving(true);
    const res = await fetch("/api/organizations/set-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, orgId: nextOrgId || null }),
    });
    setSaving(false);
    if (res.ok) {
      setOrgId(nextOrgId);
      toast.success(nextOrgId ? "Project moved into the organization." : "Project removed from its organization.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update the organization.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Building2 size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <div>
          <p className="text-sm font-medium text-ink-primary">Organization</p>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            Admins of the organization get full access to this project automatically.
          </p>
        </div>
      </div>
      {myOrgs.length === 0 ? (
        <p className="mt-3 text-xs text-ink-tertiary">
          You're not an admin of any organization yet.{" "}
          <a href="/organizations" className="font-medium text-accent hover:text-accent-hover">
            Create one
          </a>
          .
        </p>
      ) : (
        <div className="mt-3 w-full sm:w-64">
          <Select
            value={orgId}
            disabled={saving}
            onChange={(e) => save(e.target.value)}
          >
            <option value="">No organization</option>
            {myOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Card>
  );
}

function WebhookCard({ project, deliveries: initialDeliveries }) {
  const toast = useToast();
  const [url, setUrl] = useState(project.webhook_url || "");
  const [savedUrl, setSavedUrl] = useState(project.webhook_url || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [retryingId, setRetryingId] = useState(null);

  async function retry(deliveryId) {
    setRetryingId(deliveryId);
    const res = await fetch("/api/projects/webhook-retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
    setRetryingId(null);
    if (res.ok) {
      toast.success("Retry succeeded.");
      setDeliveries((d) =>
        d.map((x) => (x.id === deliveryId ? { ...x, status: "success", error: null } : x))
      );
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Retry failed.");
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/projects/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, webhookUrl: url }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Webhook URL saved.");
      setSavedUrl(url.trim());
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't save the webhook URL.");
    }
  }

  async function sendTest() {
    setTesting(true);
    const res = await fetch("/api/projects/webhook-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    setTesting(false);
    if (res.ok) {
      toast.success("Test notification sent.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't reach that URL.");
    }
  }

  return (
    <Card className="p-5" data-testid="webhook-card">
      <div className="flex items-center gap-2">
        <Webhook size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Release notifications</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Posts a message to this URL every time a new release is published. Compatible with Slack
        incoming webhooks.
      </p>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField label="Webhook URL" htmlFor="webhookUrl">
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </FormField>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" loading={saving}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={sendTest}
            loading={testing}
            disabled={!savedUrl}
          >
            Send test
          </Button>
        </div>
      </form>

      {deliveries.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          <p className="text-xs font-medium text-ink-secondary">Recent deliveries</p>
          {deliveries.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.status === "success" ? "bg-success" : "bg-danger"}`}
                />
                <span className="truncate text-ink-secondary">{d.event}</span>
                <span className="shrink-0 text-ink-tertiary">{relativeTime(d.created_at)}</span>
              </div>
              {d.status === "failed" && (
                <button
                  onClick={() => retry(d.id)}
                  disabled={retryingId === d.id}
                  className="shrink-0 font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                >
                  {retryingId === d.id ? "Retrying…" : "Retry"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-ink-secondary">
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-ink-primary">{value}</p>
        <p className="truncate text-xs text-ink-tertiary">{label}</p>
      </div>
    </Card>
  );
}
