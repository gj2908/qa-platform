import AdminShell from "../components/AdminShell";
import { createServiceClient } from "../lib/supabase";

const ACTION_LABEL = {
  user_deleted: "deleted user",
  project_deleted: "deleted project",
  uploads_deleted: "deleted upload(s)",
  orphan_file_removed: "removed orphaned file",
  token_revoked: "revoked an API token",
  admin_added: "added a platform admin",
  admin_removed: "removed a platform admin",
};

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: actions } = await service
    .from("admin_actions")
    .select("id, admin_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return { props: { actions: actions || [] } };
}

export default function AdminActivity({ actions }) {
  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Admin activity ({actions.length})
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Every destructive action taken from this panel — users, projects, uploads, and storage files.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Admin</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Detail</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {actions.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{a.admin_email}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                  {ACTION_LABEL[a.action] || a.action}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{a.detail || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(a.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {actions.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No admin actions yet.</p>}
      </div>
    </AdminShell>
  );
}
