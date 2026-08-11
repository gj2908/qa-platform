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
  Trash2,
  UserPlus,
  UserMinus,
  ArrowLeftRight,
  Users,
  Webhook,
  Clock,
} from "lucide-react";
import { useToast } from "../../../components/ui/ToastProvider";

const ACTIVITY_META = {
  release_published: { icon: Rocket, label: "published a release" },
  release_deleted: { icon: Trash2, label: "deleted a release" },
  collaborator_added: { icon: UserPlus, label: "added a collaborator" },
  collaborator_removed: { icon: UserMinus, label: "removed a collaborator" },
  ownership_transferred: { icon: ArrowLeftRight, label: "transferred ownership" },
  webhook_updated: { icon: Webhook, label: "updated release notifications" },
};

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

  return {
    props: {
      project,
      role,
      tasks: tasks || [],
      releases: releases || [],
      collaborators,
      activity,
    },
  };
}

export default function ProjectOverview({ project, role, tasks, releases, collaborators, activity }) {
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
                return (
                  <div key={c.email} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-subtle-fg">
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
            </div>
          </div>
        </div>

        {activity.length > 0 && <ActivityCard activity={activity} />}

        {isOwner(role) && <WebhookCard project={project} />}
      </div>

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
  );
}

function ActivityCard({ activity }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Clock size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Recent activity</h2>
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        {activity.map((a) => {
          const meta = ACTIVITY_META[a.action] || { icon: Clock, label: a.action };
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

function WebhookCard({ project }) {
  const toast = useToast();
  const [url, setUrl] = useState(project.webhook_url || "");
  const [savedUrl, setSavedUrl] = useState(project.webhook_url || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
    <Card className="p-5">
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
