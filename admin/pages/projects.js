import { useState } from "react";
import Link from "next/link";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";
import { Trash2, Search } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: projects } = await service
    .from("projects")
    .select("id, name, created_at, webhook_url")
    .order("created_at", { ascending: false });

  const { data: owners } = await service.from("project_collaborators").select("project_id, email").eq("role", "owner");
  const ownerByProject = Object.fromEntries((owners || []).map((o) => [o.project_id, o.email]));

  const { data: releaseCounts } = await service.from("releases").select("project_id");
  const countByProject = {};
  for (const r of releaseCounts || []) {
    if (r.project_id) countByProject[r.project_id] = (countByProject[r.project_id] || 0) + 1;
  }

  const enriched = (projects || []).map((p) => ({
    ...p,
    ownerEmail: ownerByProject[p.id] || "—",
    releaseCount: countByProject[p.id] || 0,
  }));

  return { props: { projects: enriched } };
}

export default function AdminProjects({ projects: initial }) {
  const [projects, setProjects] = useState(initial);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  const filtered = projects.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.ownerEmail.toLowerCase().includes(q);
  });

  async function deleteProject(project) {
    if (!confirm(`Permanently delete "${project.name}" and all its releases/files? This can't be undone.`)) return;
    setBusyId(project.id);
    const res = await fetch("/api/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    setBusyId(null);
    if (res.ok) {
      setProjects((p) => p.filter((x) => x.id !== project.id));
    } else {
      alert("Couldn't delete that project.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projects ({projects.length})</h1>
      <div className="relative mt-4 max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or owner…"
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Owner</th>
            <th className="px-4 py-2 font-medium">Releases</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2"></th>
          </TableHead>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/projects/${p.id}`} className="text-slate-900 hover:underline dark:text-slate-100">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{p.ownerEmail}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{p.releaseCount}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => deleteProject(p)}
                    disabled={busyId === p.id}
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
