import { useState } from "react";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import Badge from "../../components/ui/Badge";
import { createServiceClient } from "../../lib/supabase";
import { ArrowLeft } from "lucide-react";

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

  return { props: { org, members: members || [], projects: projects || [] } };
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

export default function AdminOrganizationDetail({ org, members, projects }) {
  const [seatLimit, setSeatLimit] = useState(org.seat_limit ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <AdminShell>
      <Link
        href="/organizations"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        Organizations
      </Link>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{org.name}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Created {new Date(org.created_at).toLocaleDateString()}
      </p>

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
