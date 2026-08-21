import { useState, useEffect } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import { getRequestOrigin } from "../../../lib/getRequestOrigin";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import {
  ArrowLeft,
  Palette,
  Globe,
  Webhook,
  TriangleAlert,
  Link2,
  Copy,
  RefreshCw,
  ShieldCheck,
  Megaphone,
  KeyRound,
  Check,
  Trash2,
} from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: role } = await supabase.rpc("org_role", { p_org_id: params.id });
  if (role !== "org_admin") return { notFound: true };

  const { data: announcement } = await supabase
    .from("org_announcements")
    .select("id, message, created_at, expires_at")
    .eq("org_id", params.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tokensRaw } = await supabase
    .from("org_api_tokens")
    .select("id, token_prefix, label, scope, created_at, last_used_at")
    .eq("org_id", params.id)
    .order("created_at", { ascending: false });

  return {
    props: {
      org,
      siteOrigin: getRequestOrigin(req),
      announcement: announcement || null,
      tokens: tokensRaw || [],
    },
  };
}

export default function OrganizationSettings({ org, siteOrigin, announcement, tokens }) {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <Link
            href={`/organizations/${org.id}`}
            className="inline-flex items-center gap-1 text-sm text-ink-tertiary hover:text-ink-secondary"
          >
            <ArrowLeft size={14} />
            {org.name}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-ink-primary">Organization settings</h1>
        </div>

        <BrandingCard org={org} />
        <DomainCard org={org} />
        <InviteLinkCard org={org} siteOrigin={siteOrigin} />
        <AnnouncementCard org={org} announcement={announcement} />
        <OrgTokensCard org={org} tokens={tokens} />
        <DefaultsCard org={org} />
        <SecurityCard org={org} />
        <DangerZoneCard org={org} />
      </div>
    </AppShell>
  );
}

function InviteLinkCard({ org, siteOrigin }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(org.invite_enabled);
  const [token, setToken] = useState(org.invite_token);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);

  const link = `${siteOrigin}/join-org/${token}`;

  async function callInviteLink(action) {
    const res = await fetch("/api/organizations/invite-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't update the invite link.");
      return null;
    }
    return data;
  }

  async function toggle() {
    setToggling(true);
    const data = await callInviteLink(enabled ? "disable" : "enable");
    setToggling(false);
    if (!data) return;
    setEnabled(data.inviteEnabled);
  }

  async function regenerate() {
    setRegenerating(true);
    const data = await callInviteLink("regenerate");
    setRegenerating(false);
    setConfirmingRegen(false);
    if (!data) return;
    setToken(data.inviteToken);
    setEnabled(data.inviteEnabled);
    toast.success("Invite link regenerated — the old link no longer works.");
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    toast.success("Link copied.");
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Link2 size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Invite link</h2>
        {enabled && <Badge tone="success">Enabled</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Anyone signed in with this link joins {org.name} as a member — no need to invite each person
        by email. Works under whatever domain this page is loaded from.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {enabled && (
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button type="button" variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
              <Copy size={13} strokeWidth={2.25} />
              Copy
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button type="button" variant={enabled ? "secondary" : "primary"} loading={toggling} onClick={toggle} className="w-fit">
            {enabled ? "Disable link" : "Enable link"}
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
              Regenerate
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRegen}
        title="Regenerate invite link?"
        description="The current link stops working immediately — anyone you've already shared it with will need the new one."
        confirmLabel="Regenerate"
        loading={regenerating}
        onConfirm={regenerate}
        onCancel={() => setConfirmingRegen(false)}
      />
    </Card>
  );
}

function AnnouncementCard({ org, announcement: initialAnnouncement }) {
  const toast = useToast();
  const [announcement, setAnnouncement] = useState(initialAnnouncement || null);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError("A message is required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/organizations/announcement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        message: trimmed,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't post the announcement.");
      return;
    }
    setAnnouncement(data.announcement);
    setMessage("");
    setExpiresAt("");
    toast.success("Announcement posted — every member will see it.");
  }

  async function clear() {
    setClearing(true);
    const res = await fetch("/api/organizations/announcement", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, announcementId: announcement.id }),
    });
    setClearing(false);
    setConfirmingClear(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't clear the announcement.");
      return;
    }
    setAnnouncement(null);
    toast.success("Announcement cleared.");
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Megaphone size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Announcement</h2>
        {announcement && <Badge tone="accent">Active</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Shown as a dismissible banner to every member across every project in {org.name}, until it
        expires or you clear it.
      </p>

      {announcement ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-md bg-subtle px-3.5 py-3 text-sm text-ink-secondary">
            <p>{announcement.message}</p>
            {announcement.expires_at && (
              <p className="mt-1 text-xs text-ink-tertiary">
                Expires {new Date(announcement.expires_at).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmingClear(true)}
            className="w-fit"
          >
            Clear announcement
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <FormField label="Message" error={error} hint="Keep it short — it shows as a single-line banner">
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </FormField>
          <FormField label="Expires" hint="Optional — leave blank to require clearing it manually">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-auto" />
          </FormField>
          <Button type="submit" loading={saving} className="w-fit">
            Post announcement
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={confirmingClear}
        title="Clear this announcement?"
        description="It disappears from every member's banner immediately."
        confirmLabel="Clear"
        loading={clearing}
        onConfirm={clear}
        onCancel={() => setConfirmingClear(false)}
      />
    </Card>
  );
}

function OrgTokensCard({ org, tokens: initial }) {
  const toast = useToast();
  const [tokens, setTokens] = useState(initial);
  const [label, setLabel] = useState("");
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
    const res = await fetch("/api/organizations/tokens/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, label: label.trim() }),
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
    const res = await fetch("/api/organizations/tokens/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, tokenId: revokeTarget.id }),
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
        <h2 className="text-sm font-semibold text-ink-primary">Organization API tokens</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Organization tokens are read-only and can query any project in this org via the API's{" "}
        <code className="rounded bg-subtle px-1 py-0.5 text-xs">?projectId=</code> parameter — they can't
        publish releases. For CI publishing, generate a project token from that project's Collaborators
        page instead.
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
          <FormField label="Label" hint="e.g. Data warehouse sync, status dashboard">
            <Input placeholder="release-dashboard" value={label} onChange={(e) => setLabel(e.target.value)} />
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
                  <Badge tone="neutral">read</Badge>
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
          <p className="text-xs font-medium text-ink-secondary">Example: read across the org</p>
          <a href="/docs/api" target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:text-accent-hover">
            View API docs
          </a>
        </div>
        <pre className="mt-1.5 overflow-x-auto text-xs text-ink-tertiary">
{`curl "${origin}/api/v1/releases?projectId=<project-id>" \\
  -H "Authorization: Bearer qap_..."`}
        </pre>
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title={`Revoke "${revokeTarget?.label || "this token"}"?`}
        description="Any integration using this token will immediately lose read access to every project in this org. This can't be undone."
        confirmLabel="Revoke"
        loading={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </Card>
  );
}

function BrandingCard({ org }) {
  const [logoUrl, setLogoUrl] = useState(org.logo_url || "");
  const [accentColor, setAccentColor] = useState(org.accent_color || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  async function save(e) {
    e.preventDefault();
    if (accentColor && !HEX_RE.test(accentColor)) {
      setError("Accent color must be a hex code, e.g. #3358d4");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/organizations/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        logoUrl: logoUrl.trim() || null,
        accentColor: accentColor.trim() || null,
        domain: org.domain || null,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't save branding.");
      return;
    }
    setSaved(true);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Palette size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Branding</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        The logo shows throughout the app for this org's projects and pages; the accent color only
        applies to this org's public install/share pages.
      </p>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <FormField label="Logo URL" hint="A publicly reachable image URL — square works best">
          <Input
            type="url"
            placeholder="https://yourcompany.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </FormField>
        <FormField label="Accent color" error={error} hint="Hex code, e.g. #3358d4">
          <Input
            placeholder="#3358d4"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            error={!!error}
          />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} className="w-fit">
            Save branding
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

const STATUS_META = {
  pending: { label: "Pending review", tone: "warning" },
  connected: { label: "Connected", tone: "success" },
};

function DomainCard({ org }) {
  const [domain, setDomain] = useState(org.domain || "");
  const [status, setStatus] = useState(org.domain_status || null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(requestDomain) {
    const setBusy = requestDomain ? setRequesting : setSaving;
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/organizations/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        logoUrl: org.logo_url || null,
        accentColor: org.accent_color || null,
        domain: domain.trim() || null,
        requestDomain,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't save the domain.");
      return;
    }
    setStatus(requestDomain ? data.domainStatus ?? "pending" : domain.trim() === org.domain ? org.domain_status : null);
    setSaved(true);
  }

  const isVercelApp = domain.trim().toLowerCase().endsWith(".vercel.app");
  const meta = status ? STATUS_META[status] : null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Globe size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Domain</h2>
        {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        A display label by default. Request it below to have it actually connected — this app's
        public and signed-in pages both work under any domain once connected, the same way{" "}
        <span className="font-mono text-xs">vrsnify.vercel.app</span> does today.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <FormField label="Domain" error={error} hint="e.g. acme.com, dl.acme.com, or acme.vercel.app">
          <Input
            placeholder="acme.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            error={!!error}
          />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" loading={saving} onClick={() => submit(false)} className="w-fit">
            Save
          </Button>
          <Button
            type="button"
            loading={requesting}
            disabled={!domain.trim()}
            onClick={() => submit(true)}
            className="w-fit"
          >
            Request connection
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>

        {status === "pending" && domain.trim() && (
          <div className="rounded-md bg-subtle px-3.5 py-3 text-xs text-ink-secondary">
            {isVercelApp ? (
              <p>
                No DNS setup needed on your end — this <span className="font-mono">.vercel.app</span> subdomain
                will be claimed on your behalf. We'll update the status here once it's live.
              </p>
            ) : (
              <>
                <p className="font-medium text-ink-primary">DNS setup needed</p>
                <p className="mt-1">
                  Add a CNAME record for <span className="font-mono">{domain.trim()}</span> pointing to{" "}
                  <span className="font-mono">cname.vercel-dns.com</span> (or, for a root/apex domain, an A
                  record to <span className="font-mono">76.76.21.21</span>). We'll confirm and mark this
                  connected once it resolves.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function DefaultsCard({ org }) {
  const [webhookUrl, setWebhookUrl] = useState(org.default_webhook_url || "");
  const [requireApproval, setRequireApproval] = useState(org.default_require_approval || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/organizations/set-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        defaultWebhookUrl: webhookUrl.trim() || null,
        defaultRequireApproval: requireApproval,
      }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Webhook size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Project defaults</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Applied to a project only when it's attached to this org and doesn't already have its own
        value set — never overwrites an existing per-project choice.
      </p>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <FormField
          label="Default release webhook"
          hint="Slack-incoming-webhook-compatible URL. Also fires live alongside every project's own webhook for every project in this org — not just a one-time default for new projects."
        >
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Require approval to publish, by default, for newly attached projects
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} className="w-fit">
            Save defaults
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

function SecurityCard({ org }) {
  const toast = useToast();
  const [mfaRequired, setMfaRequired] = useState(org.mfa_required);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !mfaRequired;
    setSaving(true);
    const res = await fetch("/api/organizations/set-mfa-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, mfaRequired: next }),
    });
    setSaving(false);
    if (res.ok) {
      setMfaRequired(next);
      toast.success(next ? "Two-factor authentication is now required for every member." : "Two-factor auth requirement removed.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't update this setting.");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Require two-factor authentication</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Every member is blocked from the app until they set up an authenticator app in their own Settings.
            </p>
          </div>
        </div>
        <Button variant={mfaRequired ? "primary" : "secondary"} size="sm" loading={saving} onClick={toggle}>
          {mfaRequired ? "On" : "Off"}
        </Button>
      </div>
    </Card>
  );
}

function DangerZoneCard({ org }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function confirmRequestClosure() {
    setRequesting(true);
    const res = await fetch("/api/organizations/request-closure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, reason: reason.trim() }),
    });
    setRequesting(false);
    setConfirming(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't submit the closure request.");
      return;
    }
    setRequested(true);
    toast.success("Closure requested — a platform admin will review it.");
  }

  return (
    <Card className="border-danger/30 p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert size={15} strokeWidth={2.25} className="text-danger" />
        <h2 className="text-sm font-semibold text-ink-primary">Danger zone</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Organizations are closed by a platform admin, not deleted directly — this submits a request
        for review rather than closing it immediately.
      </p>

      {requested ? (
        <p className="mt-4 text-sm text-ink-secondary">Closure requested. You'll be notified once it's reviewed.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <FormField label="Reason" hint="Optional — helps the admin review faster">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <Button variant="destructive" onClick={() => setConfirming(true)} className="w-fit">
            Request closure
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Request closure of ${org.name}?`}
        description="A platform admin will review this request. The organization stays active until they approve it."
        confirmLabel="Request closure"
        loading={requesting}
        onConfirm={confirmRequestClosure}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
