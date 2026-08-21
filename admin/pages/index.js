import AdminShell from "../components/AdminShell";
import StatCard from "../components/ui/StatCard";
import { createServiceClient } from "../lib/supabase";
import { Users, FolderKanban, PackageCheck, HardDrive, UploadCloud, TrendingUp, Inbox } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export async function getServerSideProps() {
  const service = createServiceClient();

  const { data: userList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const totalUsers = userList?.users?.length || 0;

  const { count: totalProjects } = await service.from("projects").select("id", { count: "exact", head: true });
  const { count: totalReleases } = await service.from("releases").select("id", { count: "exact", head: true });
  const { count: publicUploads } = await service
    .from("releases")
    .select("id", { count: "exact", head: true })
    .is("project_id", null);

  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count: releases7d } = await service
    .from("releases")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("created_at", since7);
  const { count: releases30d } = await service
    .from("releases")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("created_at", since30);

  const { data: sizes } = await service.from("releases").select("file_size_bytes");
  const totalBytes = (sizes || []).reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);

  const { count: pendingRequests } = await service
    .from("organization_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return {
    props: {
      stats: {
        totalUsers,
        totalProjects: totalProjects || 0,
        totalReleases: totalReleases || 0,
        publicUploads: publicUploads || 0,
        releases7d: releases7d || 0,
        releases30d: releases30d || 0,
        totalBytes,
        pendingRequests: pendingRequests || 0,
      },
    },
  };
}

export default function AdminOverview({ stats }) {
  const tiles = [
    { icon: Users, label: "Total users", value: stats.totalUsers, tone: "primary" },
    { icon: FolderKanban, label: "Total projects", value: stats.totalProjects, tone: "primary" },
    {
      icon: Inbox,
      label: "Pending org requests",
      value: stats.pendingRequests,
      tone: stats.pendingRequests > 0 ? "warning" : "neutral",
      href: "/organizations/requests",
    },
    { icon: PackageCheck, label: "Total releases", value: stats.totalReleases, tone: "neutral" },
    { icon: UploadCloud, label: "Anonymous uploads", value: stats.publicUploads, tone: "neutral" },
    { icon: TrendingUp, label: "Releases, last 7 days", value: stats.releases7d, tone: "success" },
    { icon: TrendingUp, label: "Releases, last 30 days", value: stats.releases30d, tone: "success" },
    { icon: HardDrive, label: "Storage used", value: formatBytes(stats.totalBytes), tone: "neutral" },
  ];

  return (
    <AdminShell>
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A snapshot of usage and pending work across every project and organization.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <StatCard key={t.label} {...t} index={i} />
        ))}
      </div>
    </AdminShell>
  );
}
