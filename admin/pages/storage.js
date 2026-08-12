import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";
import { relativeTime } from "../lib/format";
import { Trash2, AlertTriangle } from "lucide-react";

// Files this fresh might still be mid-upload — for an interactive
// upload, the file lands in Storage (pre-signed direct upload) *before*
// the releases row is inserted, which only happens after downloading it
// back and running analyzeIpa/analyzeAppBinary (can take several
// seconds). Never offer something this new for one-click deletion.
const MIN_ORPHAN_AGE_MS = 10 * 60 * 1000;

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
  const { data: owners } = await service.from("project_collaborators").select("project_id, email").eq("role", "owner");
  const ownerByProject = Object.fromEntries((owners || []).map((o) => [o.project_id, o.email]));

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
      const ageMs = f.created_at ? Date.now() - new Date(f.created_at).getTime() : Infinity;
      if (!knownPaths.has(fullPath) && ageMs >= MIN_ORPHAN_AGE_MS) {
        // The path's first segment is either a project id or the
        // "public" prefix used by anonymous uploads — resolve it so
        // "orphaned" doesn't read as "unrelated to anything."
        const isPublicPrefix = entry.name === "public";
        const projectName = isPublicPrefix ? null : projectNameById[entry.name] || null;
        const ownerEmail = isPublicPrefix ? null : ownerByProject[entry.name] || null;
        // Uploads are named `${Date.now()}-${filename}` — strip the
        // epoch-ms prefix so near-duplicate uploads (e.g. two abandoned
        // "App.ipa" picks) show a readable filename + upload time
        // instead of two indistinguishable raw path strings.
        const displayName = f.name.replace(/^\d+-/, "");
        orphaned.push({
          path: fullPath,
          displayName,
          createdAt: f.created_at,
          size: f.metadata?.size || 0,
          projectName,
          ownerEmail,
          isPublicPrefix,
        });
      }
    }
  }

  return { props: { perProject, orphaned } };
}

export default function AdminStorage({ perProject, orphaned: initialOrphaned }) {
  const [orphaned, setOrphaned] = useState(initialOrphaned);
  const [busy, setBusy] = useState(null);
  const totalBytes = perProject.reduce((sum, p) => sum + p.bytes, 0);

  async function removeOrphan(o) {
    const projectLabel = o.isPublicPrefix ? "an anonymous upload" : o.projectName ? `"${o.projectName}"` : "an unknown project";
    if (!confirm(`Permanently delete "${o.displayName}" (${projectLabel})? This can't be undone.`)) return;
    setBusy(o.path);
    const res = await fetch("/api/storage/remove-orphan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: o.path }),
    });
    setBusy(null);
    if (res.ok) {
      setOrphaned((prev) => prev.filter((x) => x.path !== o.path));
    } else {
      alert("Couldn't remove that file.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Storage — {formatBytes(totalBytes)} total
      </h1>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Storage used</th>
          </TableHead>
          <TableBody>
            {perProject.map((p) => (
              <TableRow key={p.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatBytes(p.bytes)}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <AlertTriangle size={15} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Orphaned files ({orphaned.length})
        </h2>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Files in storage no longer referenced by any release row — usually abandoned uploads
        (a file is saved as soon as it's picked, before the release is actually published). Uploads younger
        than 10 minutes are held back from this list in case one is still mid-publish. Safe to remove otherwise.
      </p>
      {orphaned.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None found.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {orphaned.map((o) => (
            <div
              key={o.path}
              data-testid={`orphan-row-${o.path}`}
              className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-sm last:border-0 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{o.displayName}</span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-500">uploaded {relativeTime(o.createdAt)}</span>
                </div>
                <span className="block truncate font-mono text-xs text-slate-500 dark:text-slate-500">{o.path}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-500">
                  {o.isPublicPrefix
                    ? "Anonymous upload — no project"
                    : o.projectName
                      ? `Project: ${o.projectName}${o.ownerEmail ? ` · Owner: ${o.ownerEmail}` : ""}`
                      : "No matching project — likely from a deleted project"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-slate-500">{formatBytes(o.size)}</span>
                <button
                  onClick={() => removeOrphan(o)}
                  disabled={busy === o.path}
                  title="Remove file"
                  aria-label="Remove file"
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
