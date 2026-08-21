import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../../lib/supabase/server";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import FormField from "../../components/ui/FormField";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/ToastProvider";
import { Building2, Plus, Users } from "lucide-react";

export async function getServerSideProps({ req, res }) {
  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS's "members read orgs" policy (org_role(id) is not null) already
  // scopes this to orgs the signed-in user belongs to.
  const { data: memberships } = user?.email
    ? await supabase.from("org_members").select("org_id, role").eq("email", user.email)
    : { data: [] };

  const orgIds = (memberships || []).map((m) => m.org_id);
  const roleByOrg = Object.fromEntries((memberships || []).map((m) => [m.org_id, m.role]));

  let orgs = [];
  if (orgIds.length > 0) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, seat_limit, logo_url, domain, created_at")
      .in("id", orgIds)
      .order("created_at", { ascending: false });
    orgs = (data || []).map((o) => ({ ...o, myRole: roleByOrg[o.id] }));
  }

  return { props: { orgs } };
}

export default function Organizations({ orgs: initial }) {
  const toast = useToast();
  const [orgs] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);

  async function requestOrg(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/organizations/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), reason: reason.trim() }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't submit that request.");
      return;
    }
    setRequested(true);
    setName("");
    setReason("");
    toast.success("Request submitted — a platform admin will review it.");
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Organizations</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              Group projects under a company or team, with shared membership and seats.
            </p>
          </div>
          <Button
            className="w-full sm:w-fit"
            onClick={() => {
              setCreating((c) => !c);
              setRequested(false);
            }}
          >
            <Plus size={15} strokeWidth={2.25} />
            Request an organization
          </Button>
        </div>

        {creating && (
          <Card className="p-5">
            {requested ? (
              <p className="text-sm text-ink-secondary">
                Request submitted. A platform admin will review it and set you up as the organization's
                admin once approved.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-tertiary">
                  Organizations are set up by a platform admin — submit a request and you'll be made the
                  admin of it once approved.
                </p>
                <form onSubmit={requestOrg} className="flex flex-col gap-3">
                  <FormField label="Organization name" error={error}>
                    <Input
                      placeholder="Acme Inc."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={!!error}
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Reason" hint="Optional — helps the admin review faster">
                    <Textarea
                      rows={2}
                      placeholder="What's this organization for?"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </FormField>
                  <Button type="submit" loading={saving} disabled={!name.trim()} className="w-fit">
                    Submit request
                  </Button>
                </form>
              </>
            )}
          </Card>
        )}

        {orgs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            description="Create one to group projects and manage members and seats together."
          />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {orgs.map((o) => (
              <Link
                key={o.id}
                href={`/organizations/${o.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hover"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {o.logo_url ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-subtle p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.logo_url} alt={o.name} className="h-full w-full object-contain" />
                    </span>
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                      <Building2 size={17} strokeWidth={2.25} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-ink-primary">{o.name}</p>
                      {o.domain && <span className="shrink-0 text-xs text-ink-tertiary">· {o.domain}</span>}
                    </div>
                    <p className="truncate text-xs text-ink-tertiary">
                      {o.myRole === "org_admin" ? "Admin" : "Member"}
                      {o.seat_limit ? ` · seat limit ${o.seat_limit}` : ""}
                    </p>
                  </div>
                </div>
                <Users size={14} className="shrink-0 text-ink-tertiary" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
