import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import InviteEmailPrompt from "../../../components/ui/InviteEmailPrompt";
import ExpandableList from "../../../components/ui/ExpandableList";
import SettingsSection from "../../../components/ui/SettingsSection";
import { ROLE_META, ASSIGNABLE_ROLES } from "../../../components/ui/role";
import Avatar from "../../../components/ui/Avatar";
import { activityMetaFor } from "../../../lib/activityMeta";
import { relativeTime } from "../../../lib/format";
import { UserPlus, Trash2, ArrowLeftRight, CircleAlert, Clock } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });

  const { data: collaboratorsRaw } = await supabase
    .from("project_collaborators")
    .select("email, role, created_at")
    .eq("project_id", params.id)
    .order("role");

  const { data: activityRaw } = await supabase
    .from("project_activity")
    .select("id, actor_email, action, detail, created_at")
    .eq("project_id", params.id)
    .in("action", ["collaborator_added", "collaborator_removed", "ownership_transferred"])
    .order("created_at", { ascending: false })
    .limit(20);

  let collaborators = collaboratorsRaw || [];
  let activity = activityRaw || [];
  const emails = [...new Set([...collaborators.map((c) => c.email), ...activity.map((a) => a.actor_email)])];
  if (emails.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name, avatar_url")
      .in("email", emails);
    const profileByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p]));
    collaborators = collaborators.map((c) => ({
      ...c,
      full_name: profileByEmail[c.email]?.full_name || null,
      avatar_url: profileByEmail[c.email]?.avatar_url || null,
    }));
    activity = activity.map((a) => ({ ...a, actor_name: profileByEmail[a.actor_email]?.full_name || null }));
  }

  return { props: { project, role, collaborators, activity } };
}

const ROLE_ORDER = { owner: 0, editor: 1, commenter: 2, viewer: 3 };

export default function Collaborators({ project, role: myRole, collaborators: initial, activity }) {
  const [collaborators, setCollaborators] = useState(
    [...initial].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
  );
  const [email, setEmail] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [role, setRole] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  // { emails } while InviteEmailPrompt is open, awaiting the adder's
  // send/skip choice for the unregistered addresses in the current submit.
  const [invitePrompt, setInvitePrompt] = useState(null);

  const isOwner = myRole === "owner";

  async function submitAdd(targetList, isBulk, sendInvite) {
    setAdding(true);
    const res = await fetch("/api/collaborators/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isBulk
          ? { projectId: project.id, emails: targetList, role, sendInvite }
          : { projectId: project.id, email: targetList[0], role, sendInvite }
      ),
    });
    setAdding(false);
    setInvitePrompt(null);
    const data = await res.json().catch(() => ({}));
    if (isBulk) {
      if (res.ok) {
        setBulkResults(data.results || []);
        if ((data.results || []).some((r) => r.ok)) {
          setTimeout(() => window.location.reload(), 3000);
        }
      } else {
        setError(data.error || "Couldn't add those collaborators.");
      }
    } else if (res.ok) {
      window.location.reload();
    } else {
      setError(data.error || "Couldn't add that collaborator.");
    }
  }

  async function savePreference(preference) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ invite_unregistered_preference: preference }).eq("id", user.id);
  }

  async function addCollaborator(e) {
    e.preventDefault();
    setError("");
    setBulkResults(null);

    const isBulk = bulkMode;
    const list = isBulk
      ? bulkEmails
          .split("\n")
          .map((e) => e.trim())
          .filter(Boolean)
      : email.trim()
        ? [email.trim()]
        : [];
    if (list.length === 0) return;

    // Best-effort: if the check itself fails, fall through to adding
    // with no invite rather than blocking the whole add on it.
    let unregistered = [];
    let invitePreference = "never";
    try {
      const checkRes = await fetch("/api/collaborators/check-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, emails: list }),
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        unregistered = checkData.unregistered || [];
        invitePreference = checkData.invitePreference || "ask";
      }
    } catch (err) {
      // ignored — proceed without an invite prompt
    }

    if (unregistered.length === 0) {
      await submitAdd(list, isBulk, false);
      return;
    }
    if (invitePreference === "always") {
      await submitAdd(list, isBulk, true);
      return;
    }
    if (invitePreference === "never") {
      await submitAdd(list, isBulk, false);
      return;
    }
    setInvitePrompt({ emails: unregistered, list, isBulk });
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
    <ProjectShell project={project} active="collaborators" role={myRole}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Collaborators</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            {isOwner
              ? "Manage who has access to this project and what they can do."
              : `You have ${ROLE_META[myRole]?.label.toLowerCase()} access to this project.`}{" "}
            <a href="/docs/permissions" className="text-accent hover:text-accent-hover">
              What can each role do?
            </a>
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            <CircleAlert size={14} />
            {error}
          </p>
        )}

        <SettingsSection title="People" description="Everyone with access to this project, and recent membership changes.">
          {isOwner && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink-primary">Add a collaborator</h2>
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode((b) => !b);
                    setBulkResults(null);
                    setError("");
                  }}
                  className="text-xs font-medium text-accent hover:text-accent-hover"
                >
                  {bulkMode ? "Add one at a time" : "Add several at once"}
                </button>
              </div>
              <form onSubmit={addCollaborator} className="mt-4 flex flex-col gap-3">
                {bulkMode ? (
                  <FormField label="Emails" hint="One per line">
                    <Textarea
                      rows={4}
                      placeholder={"teammate1@company.com\nteammate2@company.com"}
                      value={bulkEmails}
                      onChange={(e) => setBulkEmails(e.target.value)}
                    />
                  </FormField>
                ) : (
                  <FormField label="Email">
                    <Input
                      type="email"
                      placeholder="teammate@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                  <Button
                    type="submit"
                    loading={adding}
                    disabled={bulkMode ? !bulkEmails.trim() : !email.trim()}
                  >
                    <UserPlus size={15} strokeWidth={2.25} />
                    {bulkMode ? "Add all" : "Add"}
                  </Button>
                </div>
              </form>
              {bulkResults && (
                <div className="mt-3 rounded-md bg-subtle px-3.5 py-2.5 text-xs text-ink-secondary">
                  {bulkResults.filter((r) => r.ok).length} added
                  {bulkResults.some((r) => !r.ok) &&
                    `, ${bulkResults.filter((r) => !r.ok).length} failed: ${bulkResults
                      .filter((r) => !r.ok)
                      .map((r) => `${r.email} (${r.error})`)
                      .join(", ")}`}
                </div>
              )}
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

          <Card className="overflow-hidden">
            <ExpandableList
              items={collaborators}
              visibleCount={5}
              className="divide-y divide-border"
              toggleClassName="block w-full border-t border-border px-4 py-2.5 text-left text-xs font-medium text-accent transition-colors hover:bg-hover hover:text-accent-hover"
              renderItem={(c) => {
                const meta = ROLE_META[c.role];
                const Icon = meta.icon;
                const displayName = c.full_name || c.email;
                return (
                  <div key={c.email} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar avatarUrl={c.avatar_url} seed={c.email} displayName={displayName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink-primary">{displayName}</p>
                        {c.full_name && <p className="truncate text-xs text-ink-tertiary">{c.email}</p>}
                      </div>
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
              }}
            />
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Clock size={15} strokeWidth={2.25} className="text-ink-secondary" />
              <h2 className="text-sm font-semibold text-ink-primary">Team activity</h2>
            </div>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-ink-tertiary">No collaborator changes yet.</p>
            ) : (
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
            )}
          </Card>
        </SettingsSection>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove ${removeTarget?.full_name || removeTarget?.email}?`}
        description="They'll immediately lose access to this project's board, changelog, and releases."
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={!!transferTarget}
        title={`Make ${transferTarget?.full_name || transferTarget?.email} the owner?`}
        description="You'll become an editor on this project. Only the new owner will be able to manage collaborators, transfer ownership again, or delete the project."
        confirmLabel="Transfer ownership"
        loading={busy}
        onConfirm={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
      />

      <InviteEmailPrompt
        open={!!invitePrompt}
        emails={invitePrompt?.emails || []}
        loading={adding}
        onSendInvite={async (remember) => {
          if (remember) await savePreference("always");
          await submitAdd(invitePrompt.list, invitePrompt.isBulk, true);
        }}
        onSkip={async (remember) => {
          if (remember) await savePreference("never");
          await submitAdd(invitePrompt.list, invitePrompt.isBulk, false);
        }}
      />
    </ProjectShell>
  );
}
