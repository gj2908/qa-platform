import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { createServiceClient } from "../lib/supabase";
import { Trash2, AlertTriangle } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export async function getServerSideProps() {
  const service = createServiceClient();

  const { data: projects } = await service.from("projects").select("id, name");
  const { data: releases } = await service.from("releases").select("project_id, file_path, file_size_bytes");

  const byProject = {};
  const knownPaths = new Set();
  for (const r of releases || []) {
    if (r.file_path) knownPaths.add(r.file_path);
    const key = r.project_id || "public";
    byProject[key] = (byProject[key] || 0) + (r.file_size_bytes || 0);
  }
  const projectNameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  const perProject = Object.entries(byProject)
    .map(([id, bytes]) => ({ id, name: id === "public" ? "Anonymous uploads" : projectNameById[id] || "Deleted project", bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  // Orphaned-file scan: everything actually in the bucket vs. what
  // releases.file_path references. list() isn't recursive, so walk one
  // level of "folders" (project id prefixes + "public").
  const { data: rootEntries } = await service.storage.from("builds").list("", { limit: 1000 });
  const orphaned = [];
  for (const entry of rootEntries || []) {
    if (entry.id !== null) continue; // a root-level file, not a folder — none expected here
    const { data: files } = await service.storage.from("builds").list(entry.name, { limit: 1000 });
    for (const f of files || []) {
      const fullPath = `${entry.name}/${f.name}`;
      if (!knownPaths.has(fullPath)) {
        orphaned.push({ path: fullPath, size: f.metadata?.size || 0 });
      }
    }
  }

  return { props: { perProject, orphaned } };
}

export default function AdminStorage({ perProject, orphaned: initialOrphaned }) {
  const [orphaned, setOrphaned] = useState(initialOrphaned);
  const [busy, setBusy] = useState(null);
  const totalBytes = perProject.reduce((sum, p) => sum + p.bytes, 0);

  async function removeOrphan(path) {
    setBusy(path);
    const res = await fetch("/api/storage/remove-orphan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    setBusy(null);
    if (res.ok) {
      setOrphaned((o) => o.filter((x) => x.path !== path));
    } else {
      alert("Couldn't remove that file.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Storage — {formatBytes(totalBytes)} total
      </h1>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Storage used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {perProject.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatBytes(p.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <AlertTriangle size={15} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Orphaned files ({orphaned.length})
        </h2>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Files in storage no longer referenced by any release row — safe to remove.
      </p>
      {orphaned.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None found.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {orphaned.map((o) => (
            <div key={o.path} className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-sm last:border-0 dark:border-slate-800 dark:bg-slate-900">
              <span className="truncate font-mono text-xs text-slate-600 dark:text-slate-400">{o.path}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-slate-500">{formatBytes(o.size)}</span>
                <button
                  onClick={() => removeOrphan(o.path)}
                  disabled={busy === o.path}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
