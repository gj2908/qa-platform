import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import { createServiceClient } from "../lib/supabase";
import { Trash2, Search } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: userList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = (userList?.users || []).map((u) => u.email).filter(Boolean);
  const { data: profiles } = await service.from("profiles").select("email, full_name").in("email", emails);
  const nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));

  const users = (userList?.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      fullName: nameByEmail[u.email] || null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at || null,
      emailConfirmed: !!u.email_confirmed_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { props: { users } };
}

export default function AdminUsers({ users: initial }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || (u.fullName || "").toLowerCase().includes(q);
  });

  async function deleteUser(user) {
    if (!confirm(`Permanently delete ${user.email}? This can't be undone.`)) return;
    setBusyId(user.id);
    const res = await fetch("/api/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    setBusyId(null);
    if (res.ok) {
      setUsers((u) => u.filter((x) => x.id !== user.id));
    } else {
      alert("Couldn't delete that user.");
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Users ({users.length})</h1>
      </div>
      <div className="relative mt-4 max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email or name…"
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="mt-4">
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Verified</th>
            <th className="px-4 py-2 font-medium">Joined</th>
            <th className="px-4 py-2 font-medium">Last sign-in</th>
            <th className="px-4 py-2"></th>
          </TableHead>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{u.email}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{u.fullName || "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={u.emailConfirmed ? "success" : "warning"}>
                    {u.emailConfirmed ? "Verified" : "Unverified"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => deleteUser(u)}
                    disabled={busyId === u.id}
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
