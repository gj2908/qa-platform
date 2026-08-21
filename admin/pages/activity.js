import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import { createServiceClient } from "../lib/supabase";

const ACTION_LABEL = {
  user_deleted: "deleted user",
  project_deleted: "deleted project",
  uploads_deleted: "deleted upload(s)",
  orphan_file_removed: "removed orphaned file",
  token_revoked: "revoked an API token",
  admin_added: "added a platform admin",
  admin_removed: "removed a platform admin",
  organization_deleted: "deleted organization",
  organization_seat_limit_updated: "updated organization seat limit",
  organization_domain_status_updated: "updated organization domain status",
  organization_request_approved: "approved an organization request",
  organization_request_rejected: "rejected an organization request",
  data_retention_cleanup_run: "ran a data retention cleanup",
  org_data_exported: "exported organization data",
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

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Admin</th>
            <th className="px-4 py-2 font-medium">Action</th>
            <th className="px-4 py-2 font-medium">Detail</th>
            <th className="px-4 py-2 font-medium">When</th>
          </TableHead>
          <TableBody>
            {actions.map((a) => (
              <TableRow key={a.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{a.admin_email}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                  {ACTION_LABEL[a.action] || a.action}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{a.detail || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(a.created_at).toLocaleString()}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {actions.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No admin actions yet.</p>}
      </div>
    </AdminShell>
  );
}
