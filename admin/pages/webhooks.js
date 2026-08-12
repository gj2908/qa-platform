import { useState } from "react";
import AdminShell from "../components/AdminShell";
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

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Response</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {visible.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{d.projectName}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{d.event}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === "success"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {d.response_status || d.error || "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(d.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No deliveries.</p>}
      </div>
    </AdminShell>
  );
}
