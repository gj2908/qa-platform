import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../lib/supabase/server";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import NewProjectDialog from "../components/project/NewProjectDialog";
import AppIcon from "../components/release/AppIcon";
import PlatformBadge from "../components/ui/PlatformBadge";
import {
  FolderKanban,
  Kanban,
  ClipboardList,
  Rocket,
  Plus,
  ListTodo,
  PackageCheck,
  Ellipsis,
  Trash2,
  ExternalLink,
  UploadCloud,
  Star,
  Clock,
} from "lucide-react";
import { relativeTime } from "../lib/format";
import { ROLE_META, canManageReleases } from "../components/ui/role";
import { createClient } from "../lib/supabase/client";
import { getRecentlyViewed } from "../lib/recentlyViewed";

export async function getServerSideProps({ req, res }) {
  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: myRoles } = user?.email
    ? await supabase.from("project_collaborators").select("project_id, role").eq("email", user.email)
    : { data: [] };
  const roleByProject = Object.fromEntries((myRoles || []).map((r) => [r.project_id, r.role]));

  const { data: favoritesRaw } = user?.email
    ? await supabase.from("project_favorites").select("project_id").eq("email", user.email)
    : { data: [] };
  const favoriteIds = new Set((favoritesRaw || []).map((f) => f.project_id));

  const projects = (projectsRaw || [])
    .map((p) => ({ ...p, role: roleByProject[p.id] || null, isFavorite: favoriteIds.has(p.id) }))
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

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

  // Releases published anonymously (no project) from the public landing
  // page, matched back to this account by email.
  let myUploads = [];
  if (user?.email) {
    const { data } = await supabase
      .from("releases")
      .select("*")
      .is("project_id", null)
      .eq("uploader_email", user.email)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    myUploads = data || [];
  }

  return {
    props: {
      projects: projects || [],
      myUploads,
      stats: {
        activeProjects: projects?.length || 0,
        openTasks: openTasksCount || 0,
        lastReleaseAt: lastRelease?.created_at || null,
      },
    },
  };
}

export default function Dashboard({ projects, myUploads, stats }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteKind, setDeleteKind] = useState("project"); // "project" | "release"
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    const recentIds = new Set(projects.map((p) => p.id));
    setRecentlyViewed(
      getRecentlyViewed()
        .filter((r) => recentIds.has(r.id))
        .map((r) => projects.find((p) => p.id === r.id))
    );
  }, [projects]);

  function askDeleteProject(project) {
    setDeleteKind("project");
    setDeleteTarget(project);
  }

  function askDeleteUpload(release) {
    setDeleteKind("release");
    setDeleteTarget(release);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const endpoint = deleteKind === "project" ? "/api/projects/delete" : "/api/releases/delete";
    const body =
      deleteKind === "project" ? { projectId: deleteTarget.id } : { releaseId: deleteTarget.id };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setDeleting(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || `Couldn't delete this ${deleteKind}.`);
      setDeleteTarget(null);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Projects</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              An overview of everything your team is shipping and testing.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={15} strokeWidth={2.25} />
            New project
          </Button>
        </div>

        {deleteError && (
          <p className="rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            {deleteError}
          </p>
        )}

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

        {recentlyViewed.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Clock size={14} strokeWidth={2.25} className="text-ink-tertiary" />
              <h2 className="text-sm font-semibold text-ink-primary">Recently viewed</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
              {recentlyViewed.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
                >
                  <FolderKanban size={13} strokeWidth={2.25} className="text-ink-tertiary" />
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start tracking tasks and shipping releases."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus size={15} strokeWidth={2.25} />
                New project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={() => askDeleteProject(p)} />
            ))}
          </div>
        )}

        {myUploads.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-1">
              <UploadCloud size={14} strokeWidth={2.25} className="text-ink-tertiary" />
              <h2 className="text-sm font-semibold text-ink-primary">Your public uploads</h2>
              <span className="rounded-full border border-border bg-subtle px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
                {myUploads.length}
              </span>
            </div>
            <p className="mb-2 px-1 text-xs text-ink-tertiary">
              Builds uploaded from the public landing page under this email, not tied to a project.
            </p>
            <Card className="divide-y divide-border overflow-hidden">
              {myUploads.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AppIcon src={r.app_icon} fallbackLabel={r.app_name} size={28} />
                    <PlatformBadge platform={r.platform} />
                    <span className="truncate text-sm font-medium text-ink-primary">
                      {r.app_name || `v${r.version}`}
                    </span>
                    <span className="shrink-0 text-xs text-ink-tertiary">{relativeTime(r.created_at)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={`/share/${r.id}`}>
                      <Button size="sm" variant="secondary">
                        <ExternalLink size={13} strokeWidth={2.25} />
                        View
                      </Button>
                    </Link>
                    <button
                      onClick={() => askDeleteUpload(r)}
                      title="Delete upload"
                      className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                    >
                      <Trash2 size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={
          deleteKind === "project"
            ? `Delete "${deleteTarget?.name}"?`
            : `Delete this upload?`
        }
        description={
          deleteKind === "project"
            ? "This permanently deletes the project, its board, and every release — including uploaded build files. This can't be undone."
            : "This permanently removes the upload and its build file. Its share link will stop working. This can't be undone."
        }
        confirmLabel={deleteKind === "project" ? "Delete project" : "Delete upload"}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}

function ProjectCard({ project: p, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorite, setFavorite] = useState(p.isFavorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const menuRef = useRef(null);
  const isOwner = p.role === "owner";
  const roleMeta = ROLE_META[p.role];
  const RoleIcon = roleMeta?.icon;

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggleFavorite(e) {
    e.preventDefault();
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (favorite) {
      await supabase.from("project_favorites").delete().eq("project_id", p.id).eq("email", user.email);
    } else {
      await supabase.from("project_favorites").insert({ project_id: p.id, email: user.email });
    }
    setFavorite(!favorite);
    setFavoriteBusy(false);
  }

  return (
    <Card className="flex flex-col gap-4 p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Link
          href={`/projects/${p.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md -m-1 p-1 transition-colors hover:bg-hover"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
            <FolderKanban size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-ink-primary">{p.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="text-xs text-ink-tertiary">Created {new Date(p.created_at).toLocaleDateString()}</p>
              {roleMeta && (
                <span className="flex items-center gap-1 text-xs text-ink-tertiary">
                  <span className="text-ink-disabled">·</span>
                  <RoleIcon size={11} strokeWidth={2.25} />
                  {roleMeta.label}
                </span>
              )}
            </div>
          </div>
        </Link>
        <button
          onClick={toggleFavorite}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          className={`shrink-0 rounded-md p-1 transition-colors hover:bg-hover ${
            favorite ? "text-warning" : "text-ink-tertiary hover:text-ink-primary"
          }`}
        >
          <Star size={16} strokeWidth={2} fill={favorite ? "currentColor" : "none"} />
        </button>
        {isOwner && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md p-1 text-ink-tertiary hover:bg-hover hover:text-ink-primary"
            >
              <Ellipsis size={16} strokeWidth={2} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-border bg-surface-raised p-1 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-danger hover:bg-danger-subtle"
                >
                  <Trash2 size={13} strokeWidth={2.25} />
                  Delete project
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 border-t border-border pt-3">
        <ProjectLink href={`/projects/${p.id}/board`} icon={Kanban} label="Board" />
        <ProjectLink href={`/projects/${p.id}/changelog`} icon={ClipboardList} label="Changelog" />
        {canManageReleases(p.role) && (
          <ProjectLink href={`/projects/${p.id}/changelog?new=1`} icon={Rocket} label="Release" />
        )}
      </div>
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
