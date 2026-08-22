import { useState, useEffect } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import SettingsSection from "../../../components/ui/SettingsSection";
import Switch from "../../../components/ui/Switch";
import { useToast } from "../../../components/ui/ToastProvider";
import { relativeTime } from "../../../lib/format";
import {
  ShieldCheck,
  Scale,
  Mail,
  Building2,
  Map,
  Copy,
  Check,
  RefreshCw,
  Webhook,
  Smartphone,
  KeyRound,
  Trash2,
} from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  if (role !== "owner") return { notFound: true };

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("id, event, status, response_status, error, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(5);

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

  // Orgs the caller admins — populates the "move to organization" select
  // on OrgAssignmentCard.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminOrgMemberships } = user?.email
    ? await supabase.from("org_members").select("org_id").eq("email", user.email).eq("role", "org_admin")
    : { data: [] };
  const adminOrgIds = (adminOrgMemberships || []).map((m) => m.org_id);
  let myOrgs = [];
  if (adminOrgIds.length > 0) {
    const { data } = await supabase.from("organizations").select("id, name").in("id", adminOrgIds).order("name");
    myOrgs = data || [];
  }

  return {
    props: {
      project,
      role,
      deliveries: deliveries || [],
      tokens: tokens || [],
      devices: devices || [],
      myOrgs,
    },
  };
}

export default function ProjectSettings({ project, role, deliveries, tokens, devices, myOrgs }) {
  return (
    <ProjectShell project={project} active="settings" role={role}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Settings</h1>
          <p className="mt-1 text-sm text-ink-tertiary">Configuration for {project.name} — visible to owners only.</p>
        </div>

        <SettingsSection title="Publishing" description="How releases move from draft to published." columns={2}>
          <ApprovalSettingsCard project={project} />
          <RoadmapCard project={project} />
        </SettingsSection>

        <SettingsSection title="Notifications" description="Who hears about new activity, and how often." columns={2}>
          <DigestCard project={project} />
          <ReleaseEmailCard project={project} />
        </SettingsSection>

        <SettingsSection title="Distribution" description="Where builds and devices are tracked.">
          <WebhookCard project={project} deliveries={deliveries} />
          <DevicesCard project={project} devices={devices} />
        </SettingsSection>

        <SettingsSection title="Developer" description="Programmatic access for CI pipelines.">
          <TokensCard project={project} tokens={tokens} />
        </SettingsSection>

        <SettingsSection title="Organization & compliance" columns={2}>
          <OrgAssignmentCard project={project} myOrgs={myOrgs} />
          <LegalHoldCard project={project} />
        </SettingsSection>
      </div>
    </ProjectShell>
  );
}

function ApprovalSettingsCard({ project }) {
  const toast = useToast();
  const [requireApproval, setRequireApproval] = useState(project.require_approval);
  const [saving, setSaving] = useState(false);

  async function toggle(next) {
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldCheck size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Require approval to publish</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Editors' releases wait for an owner's approval before going out; owner publishes are unaffected.
            </p>
          </div>
        </div>
        <Switch checked={requireApproval} onChange={toggle} loading={saving} />
      </div>
    </Card>
  );
}

function RoadmapCard({ project }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(project.roadmap_enabled);
  const [token, setToken] = useState(project.roadmap_token);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/roadmap/${token}` : "";

  async function callRoadmapToggle(body) {
    const res = await fetch("/api/projects/roadmap-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't update the roadmap link.");
      return null;
    }
    return data;
  }

  async function toggle() {
    const next = !enabled;
    setToggling(true);
    const data = await callRoadmapToggle({ enabled: next });
    setToggling(false);
    if (!data) return;
    setEnabled(data.roadmapEnabled);
    toast.success(next ? "Public roadmap enabled." : "Public roadmap disabled.");
  }

  async function regenerate() {
    setRegenerating(true);
    const data = await callRoadmapToggle({ regenerate: true });
    setRegenerating(false);
    setConfirmingRegen(false);
    if (!data) return;
    setToken(data.roadmapToken);
    toast.success("Roadmap link regenerated — the old link no longer works.");
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied.");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Map size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Public roadmap</h2>
        {enabled && <Badge tone="success">Enabled</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        A read-only, no-login page showing this project's To Do, In Progress, and Review tasks —
        titles, priority, labels, and due dates only. No descriptions, assignees, or other internal
        data.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {enabled && (
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button type="button" variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
              {copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button variant={enabled ? "secondary" : "primary"} size="sm" loading={toggling} onClick={toggle} className="w-fit">
            {enabled ? "Disable roadmap" : "Enable roadmap"}
          </Button>
          {enabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRegen(true)}
              className="w-fit"
            >
              <RefreshCw size={13} strokeWidth={2.25} />
              Regenerate link
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRegen}
        title="Regenerate roadmap link?"
        description="The current link stops working immediately — anyone you've already shared it with will need the new one."
        confirmLabel="Regenerate"
        loading={regenerating}
        onConfirm={regenerate}
        onCancel={() => setConfirmingRegen(false)}
      />
    </Card>
  );
}

function DigestCard({ project }) {
  const toast = useToast();
  const [digestEnabled, setDigestEnabled] = useState(project.digest_enabled);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function toggle(next) {
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Mail size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Daily email digest</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              A daily summary of new feedback, releases, pending approvals, and expiring profiles, sent to every
              collaborator.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="secondary" size="sm" loading={sending} onClick={sendTest}>
            Send test
          </Button>
          <Switch checked={digestEnabled} onChange={toggle} loading={saving} />
        </div>
      </div>
    </Card>
  );
}

function ReleaseEmailCard({ project }) {
  const toast = useToast();
  const [releaseEmailsEnabled, setReleaseEmailsEnabled] = useState(project.release_emails_enabled);
  const [saving, setSaving] = useState(false);

  async function toggle(next) {
    setSaving(true);
    const res = await fetch("/api/projects/release-emails-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, releaseEmailsEnabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setReleaseEmailsEnabled(next);
      toast.success(next ? "Release emails enabled." : "Release emails disabled.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Mail size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Release publish emails</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Email every collaborator the moment a new release is published — separate from the daily digest.
            </p>
          </div>
        </div>
        <Switch checked={releaseEmailsEnabled} onChange={toggle} loading={saving} />
      </div>
    </Card>
  );
}

function LegalHoldCard({ project }) {
  const toast = useToast();
  const [legalHold, setLegalHold] = useState(project.legal_hold);
  const [saving, setSaving] = useState(false);

  async function toggle(next) {
    setSaving(true);
    const res = await fetch("/api/projects/legal-hold-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, legalHold: next }),
    });
    setSaving(false);
    if (res.ok) {
      setLegalHold(next);
      toast.success(next ? "Project placed under legal hold." : "Legal hold removed.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Scale size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Legal hold</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              While on, this project can't be deleted by anyone — enforced at the database level, not just this button.
            </p>
          </div>
        </div>
        <Switch checked={legalHold} onChange={toggle} loading={saving} />
      </div>
    </Card>
  );
}

function OrgAssignmentCard({ project, myOrgs }) {
  const toast = useToast();
  const [orgId, setOrgId] = useState(project.org_id || "");
  const [saving, setSaving] = useState(false);

  async function save(nextOrgId) {
    setSaving(true);
    const res = await fetch("/api/organizations/set-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, orgId: nextOrgId || null }),
    });
    setSaving(false);
    if (res.ok) {
      setOrgId(nextOrgId);
      toast.success(nextOrgId ? "Project moved into the organization." : "Project removed from its organization.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update the organization.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Building2 size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <div>
          <p className="text-sm font-medium text-ink-primary">Organization</p>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            Admins of the organization get full access to this project automatically.
          </p>
        </div>
      </div>
      {myOrgs.length === 0 ? (
        <p className="mt-3 text-xs text-ink-tertiary">
          You're not an admin of any organization yet.{" "}
          <a href="/organizations" className="font-medium text-accent hover:text-accent-hover">
            Create one
          </a>
          .
        </p>
      ) : (
        <div className="mt-3 w-full">
          <Select value={orgId} disabled={saving} onChange={(e) => save(e.target.value)}>
            <option value="">No organization</option>
            {myOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      )}
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

function DevicesCard({ project, devices: initial }) {
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
                <button
                  onClick={() => removeDevice(d)}
                  title="Remove device"
                  className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                >
                  <Trash2 size={14} strokeWidth={2.25} />
                </button>
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
