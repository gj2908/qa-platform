import { useState, useEffect } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { ROLE_META, ASSIGNABLE_ROLES, canManageReleases } from "../../../components/ui/role";
import { getAvatarColor } from "../../../lib/avatarColor";
import { useToast } from "../../../components/ui/ToastProvider";
import {
  UserPlus,
  Trash2,
  ArrowLeftRight,
  CircleAlert,
  KeyRound,
  Copy,
  Check,
  Smartphone,
} from "lucide-react";

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

  let collaborators = collaboratorsRaw || [];
  if (collaborators.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("email", collaborators.map((c) => c.email));
    const nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));
    collaborators = collaborators.map((c) => ({ ...c, full_name: nameByEmail[c.email] || null }));
  }

  // Empty for non-owners — RLS's "owner manages tokens" policy already
  // restricts this to zero rows for anyone else, no extra check needed.
  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, token_prefix, label, created_at, last_used_at, scope")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const { data: devices } = await supabase
    .from("registered_devices")
    .select("id, udid, device_name, submitted_by_email, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  return { props: { project, role, collaborators, tokens: tokens || [], devices: devices || [] } };
}

const ROLE_ORDER = { owner: 0, editor: 1, commenter: 2, viewer: 3 };

export default function Collaborators({ project, role: myRole, collaborators: initial, tokens, devices }) {
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

  const isOwner = myRole === "owner";

  async function addCollaborator(e) {
    e.preventDefault();
    setError("");
    setBulkResults(null);

    if (bulkMode) {
      const list = bulkEmails
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean);
      if (list.length === 0) return;
      setAdding(true);
      const res = await fetch("/api/collaborators/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, emails: list, role }),
      });
      setAdding(false);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBulkResults(data.results || []);
        if ((data.results || []).some((r) => r.ok)) {
          setTimeout(() => window.location.reload(), 3000);
        }
      } else {
        setError(data.error || "Couldn't add those collaborators.");
      }
      return;
    }

    if (!email.trim()) return;
    setAdding(true);
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
    <ProjectShell project={project} active="collaborators">
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

        <Card className="divide-y divide-border overflow-hidden">
          {collaborators.map((c) => {
            const meta = ROLE_META[c.role];
            const Icon = meta.icon;
            const displayName = c.full_name || c.email;
            const color = getAvatarColor(c.email);
            return (
              <div key={c.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                  >
                    {displayName[0].toUpperCase()}
                  </span>
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
          })}
        </Card>

        {canManageReleases(myRole) && <DevicesCard project={project} devices={devices} canEdit={isOwner} />}

        {isOwner && <TokensCard project={project} tokens={tokens} />}
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
    </ProjectShell>
  );
}

function DevicesCard({ project, devices: initial, canEdit }) {
  const toast = useToast();
  const [devices, setDevices] = useState(initial);
  const [copiedId, setCopiedId] = useState(null);

  function copyUdid(device) {
    navigator.clipboard.writeText(device.udid);
    setCopiedId(device.id);
    toast.success("UDID copied.");
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function removeDevice(device) {
    const res = await fetch("/api/devices/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, deviceId: device.id }),
    });
    if (res.ok) {
      setDevices((d) => d.filter((x) => x.id !== device.id));
    } else {
      toast.error("Couldn't remove that device.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Smartphone size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Registered devices</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Testers submit their UDID at{" "}
        <code className="rounded bg-subtle px-1 py-0.5 text-xs">/register-device/{project.id}</code> — copy
        them in here when regenerating an Ad Hoc provisioning profile.
      </p>

      {devices.length === 0 ? (
        <p className="mt-3 text-sm text-ink-tertiary">No devices submitted yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-border border-t border-border">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-ink-primary">{d.udid}</p>
                <p className="truncate text-xs text-ink-tertiary">
                  {d.device_name || "Unnamed device"}
                  {d.submitted_by_email ? ` · ${d.submitted_by_email}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="secondary" onClick={() => copyUdid(d)}>
                  {copiedId === d.id ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
                  Copy
                </Button>
                {canEdit && (
                  <button
                    onClick={() => removeDevice(d)}
                    title="Remove device"
                    className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                  >
                    <Trash2 size={14} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TokensCard({ project, tokens: initial }) {
  const toast = useToast();
  const [tokens, setTokens] = useState(initial);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("publish");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  // Set only after mount to avoid a server/client hydration mismatch —
  // window.location isn't available during SSR.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function createToken(e) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/projects/tokens/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, label: label.trim(), scope }),
    });
    setCreating(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNewToken(data.token);
      setTokens((t) => [
        { id: data.id, token_prefix: data.token_prefix, label: data.label, created_at: data.created_at, last_used_at: null, scope: data.scope },
        ...t,
      ]);
      setLabel("");
      setScope("publish");
    } else {
      toast.error(data.error || "Couldn't create a token.");
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    toast.success("Token copied.");
    setTimeout(() => setCopied(false), 1500);
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await fetch("/api/projects/tokens/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, tokenId: revokeTarget.id }),
    });
    setRevoking(false);
    if (res.ok) {
      setTokens((t) => t.filter((tok) => tok.id !== revokeTarget.id));
      setRevokeTarget(null);
      toast.success("Token revoked.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't revoke that token.");
      setRevokeTarget(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">API tokens</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Publish releases from a CI pipeline without signing in — see the snippet below.
      </p>

      {newToken && (
        <div className="mt-4 flex flex-col gap-2 rounded-md bg-warning-subtle px-3.5 py-3 text-sm text-warning-subtle-fg">
          <p className="font-medium">Copy this token now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-primary">
              {newToken}
            </code>
            <Button size="sm" variant="secondary" onClick={copyToken}>
              {copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={createToken} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField label="Label" hint="e.g. GitHub Actions, Fastlane">
            <Input placeholder="ios-release-pipeline" value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
        </div>
        <div className="sm:w-44">
          <FormField label="Permission">
            <Select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="publish">Read &amp; publish</option>
              <option value="read">Read-only</option>
            </Select>
          </FormField>
        </div>
        <Button type="submit" loading={creating}>
          <KeyRound size={14} strokeWidth={2.25} />
          Generate token
        </Button>
      </form>

      {tokens.length > 0 && (
        <div className="mt-4 divide-y divide-border border-t border-border">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-ink-primary">{t.label || "Untitled token"}</p>
                  <Badge tone={t.scope === "read" ? "neutral" : "accent"}>{t.scope === "read" ? "read" : "publish"}</Badge>
                </div>
                <p className="font-mono text-xs text-ink-tertiary">
                  {t.token_prefix}… · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleDateString()}` : "never used"}
                </p>
              </div>
              <button
                onClick={() => setRevokeTarget(t)}
                title="Revoke token"
                className="shrink-0 rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
              >
                <Trash2 size={14} strokeWidth={2.25} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-md bg-subtle px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-secondary">Example: publish from CI</p>
          <a href="/docs/api" target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:text-accent-hover">
            View API docs
          </a>
        </div>
        <pre className="mt-1.5 overflow-x-auto text-xs text-ink-tertiary">
{`curl -X POST ${origin}/api/ci/releases/create \\
  -H "Authorization: Bearer qap_..." \\
  -F platform=ios -F version=1.2.0 -F bundleId=com.company.app \\
  -F file=@app.ipa`}
        </pre>
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title={`Revoke "${revokeTarget?.label || "this token"}"?`}
        description="Any CI pipeline using this token will immediately be unable to publish releases. This can't be undone."
        confirmLabel="Revoke"
        loading={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </Card>
  );
}
