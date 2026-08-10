import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../lib/supabase/server";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import { FolderKanban, Kanban, ClipboardList, Rocket, Plus, ListTodo, PackageCheck } from "lucide-react";

export async function getServerSideProps({ req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const { count: openTasksCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .neq("status", "done");

  const { data: lastRelease } = await supabase
    .from("releases")
    .select("created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    props: {
      projects: projects || [],
      stats: {
        activeProjects: projects?.length || 0,
        openTasks: openTasksCount || 0,
        lastReleaseAt: lastRelease?.created_at || null,
      },
    },
  };
}

function relativeTime(dateStr) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function Dashboard({ projects, stats }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function createProject(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("projects").insert({ name, created_by: user.id });
    window.location.reload();
  }

  return (
    <AppShell title="Projects" breadcrumbs={[{ label: "Projects" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Projects</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              An overview of everything your team is shipping and testing.
            </p>
          </div>
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} strokeWidth={2.25} />
            New project
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={FolderKanban}
            label="Active projects"
            value={stats.activeProjects}
          />
          <StatTile icon={ListTodo} label="Open tasks" value={stats.openTasks} />
          <StatTile
            icon={PackageCheck}
            label="Last release"
            value={relativeTime(stats.lastReleaseAt)}
          />
        </div>

        {showForm && (
          <Card className="p-4">
            <form onSubmit={createProject} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="projectName" className="mb-1.5 block text-sm font-medium text-ink-primary">
                  Project name
                </label>
                <Input
                  id="projectName"
                  placeholder="e.g. Mobile App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={creating} disabled={!name.trim()}>
                  Create
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start tracking tasks and shipping releases."
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus size={15} strokeWidth={2.25} />
                New project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="flex flex-col gap-4 p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                    <FolderKanban size={17} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink-primary">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-tertiary">
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 border-t border-border pt-3">
                  <ProjectLink href={`/projects/${p.id}/board`} icon={Kanban} label="Board" />
                  <ProjectLink href={`/projects/${p.id}/changelog`} icon={ClipboardList} label="Changelog" />
                  <ProjectLink href={`/projects/${p.id}/new-release`} icon={Rocket} label="Release" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
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

function ProjectLink({ href, icon: Icon, label }) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </Link>
  );
}
