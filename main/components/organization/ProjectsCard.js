import Card from "../ui/Card";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import EmptyState from "../ui/EmptyState";
import { FolderKanban, FolderPlus, FolderMinus } from "lucide-react";

// The org's project list. Admin gets the add-existing-project picker (over
// projects they personally own that aren't attached anywhere) and a
// per-row remove action; a member gets the identical row markup read-only
// — no picker, no remove icon, not just a disabled version of the admin
// view.
export default function ProjectsCard({
  org,
  isAdmin,
  projects,
  unattached,
  selectedProjectIds,
  onToggleProjectSelect,
  onAddProjects,
  addingProject,
  onRequestRemove,
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <FolderKanban size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Projects</h2>
      </div>

      {isAdmin && unattached.length > 0 && (
        <form onSubmit={onAddProjects} className="mt-4 flex flex-col gap-3">
          <FormField label={`Add your project${unattached.length === 1 ? "" : "s"} (select one or more)`}>
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
              {unattached.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-ink-primary hover:bg-subtle"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(p.id)}
                    onChange={(e) => onToggleProjectSelect(p.id, e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-accent"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </FormField>
          <Button type="submit" loading={addingProject} disabled={selectedProjectIds.length === 0} className="self-start">
            <FolderPlus size={15} strokeWidth={2.25} />
            {selectedProjectIds.length > 1 ? `Add ${selectedProjectIds.length} projects` : "Add"}
          </Button>
        </form>
      )}

      {projects.length === 0 ? (
        isAdmin ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={
              unattached.length > 0
                ? "Add one of your existing projects above, or from a project's own Settings page."
                : "Create a project from the dashboard, then add it here or from the project's own Settings page."
            }
            className="mt-4"
          />
        ) : (
          <p className="mt-3 text-sm text-ink-tertiary">
            You don't have access to any of this organization's projects yet — ask an admin to add you as a
            collaborator on one.
          </p>
        )
      ) : (
        <div className="mt-3 divide-y divide-border border-t border-border">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2">
              <a href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate text-sm text-ink-primary hover:text-accent">
                {p.name}
              </a>
              {isAdmin && (
                <button
                  onClick={() => onRequestRemove(p)}
                  title="Remove from organization"
                  className="shrink-0 rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                >
                  <FolderMinus size={14} strokeWidth={2.25} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
