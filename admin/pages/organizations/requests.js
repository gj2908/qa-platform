import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import { Table, TableHead, TableBody, TableRow } from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { createServiceClient, createRealtimeClientBrowser } from "../../lib/supabase";
import { Check, X } from "lucide-react";

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: requests } = await service
    .from("organization_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(100);

  const orgIds = [...new Set((requests || []).filter((r) => r.org_id).map((r) => r.org_id))];
  let nameByOrgId = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await service.from("organizations").select("id, name").in("id", orgIds);
    nameByOrgId = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));
  }

  return {
    props: {
      requests: (requests || []).map((r) => ({ ...r, org_name_resolved: r.org_id ? nameByOrgId[r.org_id] || null : null })),
    },
  };
}

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "neutral" };

export default function OrganizationRequests({ requests: initial }) {
  const [requests, setRequests] = useState(initial);
  const [busyId, setBusyId] = useState(null);
  const [justUpdated, setJustUpdated] = useState(false);

  // Live-refreshes the table when a request is filed or resolved from
  // anywhere else (main/'s "Request an organization" flow, or another
  // admin acting on the same queue) — same is_platform_admin()-gated
  // realtime access as the nav badge (lib/useOrgRequestCount.js).
  useEffect(() => {
    let cancelled = false;
    let supabase;
    let channel;

    function onChange() {
      fetch("/api/organizations/requests/list")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setRequests(data.requests);
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 1500);
        })
        .catch(() => {});
    }

    createRealtimeClientBrowser().then((client) => {
      if (cancelled) return;
      supabase = client;
      channel = supabase
        .channel("organization_requests_list")
        .on("postgres_changes", { event: "*", schema: "public", table: "organization_requests" }, onChange)
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, []);

  async function resolve(request, action) {
    setBusyId(request.id);
    const res = await fetch(`/api/organizations/requests/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id }),
    });
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || `Couldn't ${action} that request.`);
      return;
    }
    setRequests((rs) =>
      rs.map((r) =>
        r.id === request.id
          ? { ...r, status: action === "approve" ? "approved" : "rejected", org_id: data.orgId || r.org_id }
          : r
      )
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <AdminShell>
      <div className="flex items-center gap-2.5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Organization requests ({pending.length} pending)
        </h1>
        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Org creation and closure are requested from main/, not self-serve — approve provisions the
        org (or removes it); reject leaves everything as-is. Updates here automatically as new
        requests come in.
      </p>

      <div className={`mt-5 rounded-lg transition-shadow ${justUpdated ? "ring-2 ring-primary-400/50" : ""}`}>
        <Table>
          <TableHead>
            <th className="px-4 py-2 font-medium">Requester</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Organization</th>
            <th className="px-4 py-2 font-medium">Reason</th>
            <th className="px-4 py-2 font-medium">Requested</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2"></th>
          </TableHead>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                  No requests yet.
                </td>
              </TableRow>
            )}
            {requests.map((r) => (
              <TableRow key={r.id}>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{r.requester_email}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                  {r.type === "create" ? "Create" : "Close"}
                </td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                  {r.type === "create" ? (
                    r.org_name
                  ) : r.org_name_resolved ? (
                    <Link href={`/organizations/${r.org_id}`} className="hover:underline">
                      {r.org_name_resolved}
                    </Link>
                  ) : (
                    <span className="text-slate-400">already gone</span>
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-slate-500 dark:text-slate-400" title={r.reason || ""}>
                  {r.reason || "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(r.requested_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.status === "pending" && (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => resolve(r, "approve")}
                        disabled={busyId === r.id}
                        title="Approve"
                        className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40 dark:hover:bg-emerald-950"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => resolve(r, "reject")}
                        disabled={busyId === r.id}
                        title="Reject"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}
