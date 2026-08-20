import { useState } from "react";
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
import { ArrowLeft, Palette, Globe, Webhook, TriangleAlert, Link2, Copy, RefreshCw } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: role } = await supabase.rpc("org_role", { p_org_id: params.id });
  if (role !== "org_admin") return { notFound: true };

  return { props: { org, siteOrigin: getRequestOrigin(req) } };
}

export default function OrganizationSettings({ org, siteOrigin }) {
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
        <DefaultsCard org={org} />
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
        <FormField label="Default release webhook" hint="Slack-incoming-webhook-compatible URL">
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
