import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";

export async function getServerSideProps() {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await service
    .from("tasks")
    .select("id, project_id, title, assignee_email, due_date, status")
    .lt("due_date", today)
    .neq("status", "done")
    .order("due_date", { ascending: true });

  const projectIds = [...new Set((tasks || []).map((t) => t.project_id))];
  let projectNameById = {};
  if (projectIds.length > 0) {
    const { data: projects } = await service.from("projects").select("id, name").in("id", projectIds);
    projectNameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  }

  const enriched = (tasks || []).map((t) => ({
    ...t,
    projectName: projectNameById[t.project_id] || "Deleted project",
    daysOverdue: Math.floor((Date.now() - new Date(t.due_date + "T00:00:00").getTime()) / 86_400_000),
  }));

  return { props: { tasks: enriched } };
}

// Read-only, cross-project — admins don't edit other projects' boards
// directly, this is purely for spotting where things are stuck.
export default function AdminTasks({ tasks }) {
  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Overdue tasks ({tasks.length})</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Open tasks (not done) past their due date, across every project.
      </p>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Task</th>
            <th className="px-4 py-2 font-medium">Assignee</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Overdue by</th>
          </TableHead>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{t.projectName}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{t.title}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{t.assignee_email || "Unassigned"}</td>
                <td className="px-4 py-2.5 capitalize text-slate-500 dark:text-slate-400">
                  {t.status.replace("_", " ")}
                </td>
                <td className="px-4 py-2.5 text-red-600 dark:text-red-400">
                  {t.daysOverdue} day{t.daysOverdue === 1 ? "" : "s"}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tasks.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nothing overdue.</p>}
      </div>
    </AdminShell>
  );
}
