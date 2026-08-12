import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";
import { Trash2 } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: tokens } = await service
    .from("api_tokens")
    .select("id, project_id, token_prefix, label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  const projectIds = [...new Set((tokens || []).map((t) => t.project_id))];
  let projectNameById = {};
  if (projectIds.length > 0) {
    const { data: projects } = await service.from("projects").select("id, name").in("id", projectIds);
    projectNameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  }

  const enriched = (tokens || []).map((t) => ({
    ...t,
    projectName: projectNameById[t.project_id] || "Deleted project",
  }));

  return { props: { tokens: enriched } };
}

// The raw token value is never stored anywhere (lib/apiTokens.js) — only
// token_prefix is shown here, same as the per-project Collaborators page.
export default function AdminTokens({ tokens: initial }) {
  const [tokens, setTokens] = useState(initial);
  const [busyId, setBusyId] = useState(null);

  async function revoke(token) {
    if (!confirm(`Revoke the token "${token.label || token.token_prefix}" for ${token.projectName}?`)) return;
    setBusyId(token.id);
    const res = await fetch("/api/tokens/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: token.id }),
    });
    setBusyId(null);
    if (res.ok) {
      setTokens((t) => t.filter((x) => x.id !== token.id));
    } else {
      alert("Couldn't revoke that token.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">API tokens ({tokens.length})</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        CI/CD tokens issued across every project.
      </p>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Label</th>
            <th className="px-4 py-2 font-medium">Token</th>
            <th className="px-4 py-2 font-medium">Last used</th>
            <th className="px-4 py-2"></th>
          </TableHead>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{t.projectName}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{t.label || "Untitled token"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {t.token_prefix}…
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : "Never used"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => revoke(t)}
                    disabled={busyId === t.id}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tokens.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No tokens issued.</p>}
      </div>
    </AdminShell>
  );
}
