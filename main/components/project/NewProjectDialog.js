import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import FormField from "../ui/FormField";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { FolderKanban, X } from "lucide-react";

// Floating dialog version of the "New project" form, matching
// NewReleaseDialog's pattern — creating a project no longer pushes an
// inline form into the page flow.
export default function NewProjectDialog({ open, onClose }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  function handleClose() {
    if (creating) return;
    onClose();
  }

  async function createProject(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Generate the id client-side and insert without .select() — chaining
    // .select() onto this insert fails RLS: the "members read projects"
    // SELECT policy (project_role(id) is not null) is checked for the
    // RETURNING clause before assign_project_owner()'s AFTER INSERT trigger
    // has run within the same statement, so it sees no project_collaborators
    // row yet (confirmed live — this is a real, pre-existing RLS/trigger
    // ordering gap, not specific to the new org_role() work). A bare insert
    // isn't affected, and knowing the id upfront avoids needing a follow-up
    // query.
    const projectId = crypto.randomUUID();
    await supabase.from("projects").insert({ id: projectId, name, created_by: user.id });
    await supabase.from("project_activity").insert({
      project_id: projectId,
      actor_email: user.email,
      action: "project_created",
    });
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-neutral-950/50" onClick={handleClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
              <FolderKanban size={14} strokeWidth={2.25} />
            </span>
            <h2 className="text-sm font-semibold text-ink-primary">New project</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={creating}
            className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={createProject} className="flex flex-col gap-4 px-5 py-5">
          <FormField label="Project name" htmlFor="projectName">
            <Input
              id="projectName"
              placeholder="e.g. Mobile App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" loading={creating} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
