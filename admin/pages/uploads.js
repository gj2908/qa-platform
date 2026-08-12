import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";
import { Trash2 } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: uploads } = await service
    .from("releases")
    .select("id, app_name, platform, version, uploader_email, file_path, file_size_bytes, created_at")
    .is("project_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return { props: { uploads: uploads || [] } };
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Anonymous, no-login public uploads have no rate-limiting on the main
// app — this is the concrete moderation surface for that: bulk-select
// and delete abusive or stale uploads.
export default function AdminUploads({ uploads: initial }) {
  const [uploads, setUploads] = useState(initial);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === uploads.length ? new Set() : new Set(uploads.map((u) => u.id))));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} upload(s)? This can't be undone.`)) return;
    setBusy(true);
    const res = await fetch("/api/uploads/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseIds: [...selected] }),
    });
    setBusy(false);
    if (res.ok) {
      setUploads((u) => u.filter((x) => !selected.has(x.id)));
      setSelected(new Set());
    } else {
      alert("Couldn't delete the selected uploads.");
    }
  }

  function selectOlderThan(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    setSelected(new Set(uploads.filter((u) => new Date(u.created_at).getTime() < cutoff).map((u) => u.id)));
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Anonymous uploads ({uploads.length})
        </h1>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={13} />
            Delete {selected.size} selected
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Select uploads older than:</span>
        {[30, 60, 90].map((days) => (
          <button
            key={days}
            onClick={() => selectOlderThan(days)}
            className="rounded-full border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {days} days
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2">
              <input type="checkbox" checked={selected.size === uploads.length && uploads.length > 0} onChange={toggleAll} />
            </th>
            <th className="px-4 py-2 font-medium">App</th>
            <th className="px-4 py-2 font-medium">Platform</th>
            <th className="px-4 py-2 font-medium">Uploader</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Uploaded</th>
          </TableHead>
          <TableBody>
            {uploads.map((u) => (
              <TableRow key={u.id}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                </td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">
                  {u.app_name || `v${u.version}`}
                </td>
                <td className="px-4 py-2.5 capitalize text-slate-600 dark:text-slate-400">{u.platform}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{u.uploader_email || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatBytes(u.file_size_bytes)}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {uploads.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No anonymous uploads.</p>}
      </div>
    </AdminShell>
  );
}
