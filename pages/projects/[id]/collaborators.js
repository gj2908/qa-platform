import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { ROLE_META, ASSIGNABLE_ROLES } from "../../../components/ui/role";
import { UserPlus, Trash2, ArrowLeftRight, CircleAlert } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });

  const { data: collaborators } = await supabase
    .from("project_collaborators")
    .select("email, role, created_at")
    .eq("project_id", params.id)
    .order("role");

  return { props: { project, role, collaborators: collaborators || [] } };
}

const ROLE_ORDER = { owner: 0, editor: 1, commenter: 2, viewer: 3 };

export default function Collaborators({ project, role: myRole, collaborators: initial }) {
  const [collaborators, setCollaborators] = useState(
    [...initial].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const isOwner = myRole === "owner";

  async function addCollaborator(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/collaborators/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, email: email.trim(), role }),
    });
    setAdding(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't add that collaborator.");
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    const res = await fetch("/api/collaborators/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, email: removeTarget.email }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't remove that collaborator.");
      setRemoveTarget(null);
    }
  }

  async function confirmTransfer() {
    if (!transferTarget) return;
    setBusy(true);
    const res = await fetch("/api/collaborators/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, newOwnerEmail: transferTarget.email }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't transfer ownership.");
      setTransferTarget(null);
    }
  }

  return (
    <AppShell
      project={project}
      breadcrumbs={[
        { label: "Projects", href: "/dashboard" },
        { label: project.name },
        { label: "Collaborators" },
      ]}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Collaborators</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            {isOwner
              ? "Manage who has access to this project and what they can do."
              : `You have ${ROLE_META[myRole]?.label.toLowerCase()} access to this project.`}
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            <CircleAlert size={14} />
            {error}
          </p>
        )}

        {isOwner && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-primary">Add a collaborator</h2>
            <form onSubmit={addCollaborator} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FormField label="Email">
                  <Input
                    type="email"
                    placeholder="teammate@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="w-full sm:w-40">
                <FormField label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Button type="submit" loading={adding} disabled={!email.trim()}>
                <UserPlus size={15} strokeWidth={2.25} />
                Add
              </Button>
            </form>
            <dl className="mt-4 grid grid-cols-1 gap-2 text-xs text-ink-tertiary sm:grid-cols-3">
              <div>
                <dt className="font-medium text-ink-secondary">Viewer</dt>
                <dd>Install and view only</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-secondary">Commenter</dt>
                <dd>Install, view, and use the board</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-secondary">Editor</dt>
                <dd>Board, plus publish and delete releases</dd>
              </div>
            </dl>
          </Card>
        )}

        <Card className="divide-y divide-border overflow-hidden">
          {collaborators.map((c) => {
            const meta = ROLE_META[c.role];
            const Icon = meta.icon;
            return (
              <div key={c.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-subtle-fg">
                    {c.email[0].toUpperCase()}
                  </span>
                  <span className="truncate text-sm text-ink-primary">{c.email}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={meta.tone} icon={Icon}>
                    {meta.label}
                  </Badge>
                  {isOwner && c.role !== "owner" && (
                    <>
                      <button
                        onClick={() => setTransferTarget(c)}
                        title="Transfer ownership"
                        className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary"
                      >
                        <ArrowLeftRight size={14} strokeWidth={2.25} />
                      </button>
                      <button
                        onClick={() => setRemoveTarget(c)}
                        title="Remove collaborator"
                        className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                      >
                        <Trash2 size={14} strokeWidth={2.25} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove ${removeTarget?.email}?`}
        description="They'll immediately lose access to this project's board, changelog, and releases."
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={!!transferTarget}
        title={`Make ${transferTarget?.email} the owner?`}
        description="You'll become an editor on this project. Only the new owner will be able to manage collaborators, transfer ownership again, or delete the project."
        confirmLabel="Transfer ownership"
        loading={busy}
        onConfirm={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
      />
    </AppShell>
  );
}
