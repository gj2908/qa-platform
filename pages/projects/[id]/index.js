import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import PlatformBadge from "../../../components/ui/PlatformBadge";
import AppIcon from "../../../components/release/AppIcon";
import NewReleaseDialog from "../../../components/release/NewReleaseDialog";
import { ROLE_META, canManageReleases } from "../../../components/ui/role";
import { STATUS_META, STATUS_ORDER } from "../../../components/ui/status";
import { relativeTime } from "../../../lib/format";
import { Kanban, ClipboardList, ListTodo, PackageCheck, Plus, Rocket, Users } from "lucide-react";

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
  const { data: collaborators } = await supabase
    .from("project_collaborators")
    .select("email, role")
    .eq("project_id", params.id);

  return {
    props: {
      project,
      role,
      tasks: tasks || [],
      releases: releases || [],
      collaborators: collaborators || [],
    },
  };
}

export default function ProjectOverview({ project, role, tasks, releases, collaborators }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canEdit = canManageReleases(role);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const roleMeta = ROLE_META[role];

  return (
    <ProjectShell project={project} active="overview">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
                return (
                  <div key={c.email} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-subtle-fg">
                      {c.email[0].toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-primary">{c.email}</p>
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
      </div>

      <NewReleaseDialog project={project} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ProjectShell>
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
