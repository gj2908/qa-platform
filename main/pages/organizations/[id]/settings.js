import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import { ArrowLeft, Palette, Globe } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: role } = await supabase.rpc("org_role", { p_org_id: params.id });
  if (role !== "org_admin") return { notFound: true };

  return { props: { org } };
}

export default function OrganizationSettings({ org }) {
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
      </div>
    </AppShell>
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
    setStatus(requestDomain ? "pending" : domain.trim() === org.domain ? org.domain_status : null);
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
