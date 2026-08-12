import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import FormField from "../../../components/ui/FormField";
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
} from "lucide-react";
import { useToast } from "../../../components/ui/ToastProvider";
import { activityMetaFor } from "../../../lib/activityMeta";
import BarChart from "../../../components/ui/BarChart";
import { TrendingUp } from "lucide-react";
import { getAvatarColor } from "../../../lib/avatarColor";

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
    const { data: profiles } = await supabase.from("profiles").select("email, full_name").in("email", emails);
    const nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));
    collaborators = collaborators.map((c) => ({ ...c, full_name: nameByEmail[c.email] || null }));
    activity = activity.map((a) => ({ ...a, actor_name: nameByEmail[a.actor_email] || null }));
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

  return {
    props: {
      project,
      installTrend,
      versionAdoption,
      feedbackStats,
      deliveries: deliveries || [],
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
  feedbackStats,
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile icon={ListTodo} label="Open tasks" value={openTasks} />
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
                const color = getAvatarColor(c.email);
                return (
                  <div key={c.email} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                    >
                      {displayName[0].toUpperCase()}
                    </span>
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
            </div>
          </div>
        </div>

        <InsightsCard installTrend={installTrend} versionAdoption={versionAdoption} feedbackStats={feedbackStats} />

        {activity.length > 0 && <ActivityCard activity={activity} projectId={project.id} isOwner={isOwner(role)} />}

        {isOwner(role) && <ApprovalSettingsCard project={project} />}
        {isOwner(role) && <WebhookCard project={project} deliveries={deliveries} />}
        {isOwner(role) && <DigestCard project={project} />}
      </div>

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
  );
}

function InsightsCard({ installTrend, versionAdoption, feedbackStats }) {
  const totalInstalls = installTrend.reduce((sum, d) => sum + d.value, 0);

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
      <div className="mt-4 flex flex-col gap-3.5">
        {activity.map((a) => {
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
        })}
      </div>
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
