import { useState } from "react";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import Badge from "../../components/ui/Badge";
import StatCard from "../../components/ui/StatCard";
import { createServiceClient } from "../../lib/supabase";
import { formatBytes } from "../../lib/format";
import { ArrowLeft, PackageCheck, HardDrive, Activity, Download } from "lucide-react";

export async function getServerSideProps({ params }) {
  const service = createServiceClient();
  const { data: org } = await service.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: members } = await service
    .from("org_members")
    .select("email, role, created_at")
    .eq("org_id", params.id)
    .order("role");

  const { data: projects } = await service
    .from("projects")
    .select("id, name, created_at")
    .eq("org_id", params.id)
    .order("name");

  // Release/storage/activity aggregates are tallied in JS from a couple of
  // narrow queries rather than a SQL aggregate, matching this page's
  // existing member/project count style. Guard the empty-org case so we
  // never hand Postgrest an empty `.in()` array.
  const projectIds = (projects || []).map((p) => p.id);
  let releaseCount = 0;
  let totalStorageBytes = 0;
  let activityCount30d = 0;
  if (projectIds.length > 0) {
    const { data: releases } = await service
      .from("releases")
      .select("id, file_size_bytes")
      .in("project_id", projectIds);
    releaseCount = (releases || []).length;
    totalStorageBytes = (releases || []).reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count } = await service
      .from("project_activity")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds)
      .gt("created_at", since30);
    activityCount30d = count || 0;
  }

  return {
    props: {
      org,
      members: members || [],
      projects: projects || [],
      releaseCount,
      totalStorageBytes,
      activityCount30d,
    },
  };
}

function Section({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {title}
      </div>
      <div className="bg-white dark:bg-slate-900">{children}</div>
    </div>
  );
}

export default function AdminOrganizationDetail({
  org,
  members,
  projects,
  releaseCount,
  totalStorageBytes,
  activityCount30d,
}) {
  const [seatLimit, setSeatLimit] = useState(org.seat_limit ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [domainStatus, setDomainStatus] = useState(org.domain_status);
  const [domainSaving, setDomainSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  async function saveSeatLimit() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/organizations/set-seat-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, seatLimit: seatLimit === "" ? null : Number(seatLimit) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      alert("Couldn't update the seat limit.");
    }
  }

  async function setDomain(nextStatus) {
    setDomainSaving(true);
    const res = await fetch("/api/organizations/set-domain-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, domainStatus: nextStatus }),
    });
    setDomainSaving(false);
    if (res.ok) {
      setDomainStatus(nextStatus);
    } else {
      alert("Couldn't update the domain status.");
    }
  }

  async function checkNow() {
    setChecking(true);
    const res = await fetch("/api/organizations/check-domain-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id }),
    });
    setChecking(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Couldn't check the domain.");
      return;
    }
    setDomainStatus(data.domainStatus);
    if (data.domainStatus !== "connected") alert(data.detail || "Not connected yet — DNS may still be propagating.");
  }

  return (
    <AdminShell>
      <Link
        href="/organizations"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        Organizations
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Created {new Date(org.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/organizations/export?orgId=${org.id}&format=csv`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download size={14} />
            Export CSV
          </a>
          <a
            href={`/api/organizations/export?orgId=${org.id}&format=json`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download size={14} />
            Export JSON
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={PackageCheck} label="Releases" value={releaseCount} index={0} />
        <StatCard icon={HardDrive} label="Storage used" value={formatBytes(totalStorageBytes)} index={1} />
        <StatCard icon={Activity} label="Activity (30d)" value={activityCount30d} index={2} />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <Section title="Seat limit override">
          <div className="flex items-center gap-2 p-4">
            <input
              type="number"
              min="0"
              placeholder="Unlimited"
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
              className="h-9 w-32 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              onClick={saveSeatLimit}
              disabled={saving}
              className="h-9 rounded-md bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
            <span className="text-xs text-slate-400">{members.length} seat(s) currently used</span>
          </div>
        </Section>

        {org.domain && (
          <Section title="Domain connection">
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{org.domain}</span>
                <Badge tone={domainStatus === "connected" ? "success" : domainStatus === "pending" ? "warning" : "neutral"}>
                  {domainStatus === "connected" ? "Connected" : domainStatus === "pending" ? "Pending" : "Display only"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {domainStatus === "pending"
                  ? "Requested by an org admin — auto-provisioned on Vercel if configured, and rechecked daily. \"Check now\" runs that check immediately; \"Mark connected\" is a manual override if you've confirmed it yourself."
                  : "No connection requested, or already handled."}
              </p>
              <div className="flex items-center gap-2">
                {domainStatus === "pending" && (
                  <button
                    onClick={checkNow}
                    disabled={checking}
                    className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {checking ? "Checking…" : "Check now"}
                  </button>
                )}
                <button
                  onClick={() => setDomain("connected")}
                  disabled={domainSaving || domainStatus === "connected"}
                  className="h-9 rounded-md bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Mark connected
                </button>
                <button
                  onClick={() => setDomain(null)}
                  disabled={domainSaving || domainStatus == null}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear status
                </button>
              </div>
            </div>
          </Section>
        )}

        <Section title={`Members (${members.length})`}>
          {members.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No members.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {members.map((m) => (
                <div key={m.email} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{m.email}</span>
                  <Badge tone={m.role === "org_admin" ? "primary" : "neutral"}>
                    {m.role === "org_admin" ? "Admin" : "Member"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Projects (${projects.length})`}>
          {projects.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No projects assigned.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AdminShell>
  );
}
