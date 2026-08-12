import { useState } from "react";
import Link from "next/link";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";
import { Trash2, Search } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: orgs } = await service
    .from("organizations")
    .select("id, name, seat_limit, created_at")
    .order("created_at", { ascending: false });

  const { data: members } = await service.from("org_members").select("org_id");
  const memberCountByOrg = {};
  for (const m of members || []) {
    memberCountByOrg[m.org_id] = (memberCountByOrg[m.org_id] || 0) + 1;
  }

  const { data: projects } = await service.from("projects").select("org_id").not("org_id", "is", null);
  const projectCountByOrg = {};
  for (const p of projects || []) {
    projectCountByOrg[p.org_id] = (projectCountByOrg[p.org_id] || 0) + 1;
  }

  const enriched = (orgs || []).map((o) => ({
    ...o,
    memberCount: memberCountByOrg[o.id] || 0,
    projectCount: projectCountByOrg[o.id] || 0,
  }));

  return { props: { orgs: enriched } };
}

export default function AdminOrganizations({ orgs: initial }) {
  const [orgs, setOrgs] = useState(initial);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  const filtered = orgs.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.name.toLowerCase().includes(q);
  });

  async function deleteOrg(org) {
    if (
      !confirm(
        `Delete "${org.name}"? Its ${org.projectCount} project(s) will be ungrouped, not deleted. This can't be undone.`
      )
    )
      return;
    setBusyId(org.id);
    const res = await fetch("/api/organizations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id }),
    });
    setBusyId(null);
    if (res.ok) {
      setOrgs((o) => o.filter((x) => x.id !== org.id));
    } else {
      alert("Couldn't delete that organization.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Organizations ({orgs.length})</h1>
      <div className="relative mt-4 max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name…"
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Organization</th>
            <th className="px-4 py-2 font-medium">Members</th>
            <th className="px-4 py-2 font-medium">Projects</th>
            <th className="px-4 py-2 font-medium">Seat limit</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2"></th>
          </TableHead>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/organizations/${o.id}`} className="text-slate-900 hover:underline dark:text-slate-100">
                    {o.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{o.memberCount}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{o.projectCount}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{o.seat_limit ?? "Unlimited"}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => deleteOrg(o)}
                    disabled={busyId === o.id}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}
