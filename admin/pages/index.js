import AdminShell from "../components/AdminShell";
import { createServiceClient } from "../lib/supabase";
import { Users, FolderKanban, PackageCheck, HardDrive, UploadCloud, TrendingUp } from "lucide-react";

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
      },
    },
  };
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon size={15} strokeWidth={2} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function AdminOverview({ stats }) {
  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Platform overview</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Total users" value={stats.totalUsers} />
        <StatTile icon={FolderKanban} label="Total projects" value={stats.totalProjects} />
        <StatTile icon={PackageCheck} label="Total releases" value={stats.totalReleases} />
        <StatTile icon={UploadCloud} label="Anonymous uploads" value={stats.publicUploads} />
        <StatTile icon={TrendingUp} label="Releases, last 7 days" value={stats.releases7d} />
        <StatTile icon={TrendingUp} label="Releases, last 30 days" value={stats.releases30d} />
        <StatTile icon={HardDrive} label="Storage used" value={formatBytes(stats.totalBytes)} />
      </div>
    </AdminShell>
  );
}
