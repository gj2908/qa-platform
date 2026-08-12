import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import { createServiceClient } from "../lib/supabase";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: deliveries } = await service
    .from("webhook_deliveries")
    .select("id, project_id, event, status, response_status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const projectIds = [...new Set((deliveries || []).map((d) => d.project_id))];
  let projectNameById = {};
  if (projectIds.length > 0) {
    const { data: projects } = await service.from("projects").select("id, name").in("id", projectIds);
    projectNameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  }

  const enriched = (deliveries || []).map((d) => ({
    ...d,
    projectName: projectNameById[d.project_id] || "Deleted project",
  }));

  return { props: { deliveries: enriched } };
}

// Cross-project read-only monitor — webhook_deliveries is only visible
// per-project (with retry) in the main app; this surfaces failures across
// every project in one place to spot a pattern. No retry/delete here,
// that stays a per-project owner action.
export default function AdminWebhooks({ deliveries }) {
  const [failedOnly, setFailedOnly] = useState(false);
  const visible = failedOnly ? deliveries.filter((d) => d.status === "failed") : deliveries;

  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Webhook deliveries ({visible.length})
        </h1>
        <button
          onClick={() => setFailedOnly((f) => !f)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            failedOnly
              ? "bg-red-600 text-white"
              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {failedOnly ? "Showing failed only" : "Show failed only"}
        </button>
      </div>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Event</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Response</th>
            <th className="px-4 py-2 font-medium">When</th>
          </TableHead>
          <TableBody>
            {visible.map((d) => (
              <TableRow key={d.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{d.projectName}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{d.event}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={d.status === "success" ? "success" : "danger"}>{d.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {d.response_status || d.error || "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(d.created_at).toLocaleString()}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {visible.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No deliveries.</p>}
      </div>
    </AdminShell>
  );
}
