import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import Badge from "../../components/ui/Badge";
import { createServiceClient } from "../../lib/supabase";
import { ArrowLeft } from "lucide-react";

export async function getServerSideProps({ params }) {
  const service = createServiceClient();
  const { data: project } = await service.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: collaborators } = await service
    .from("project_collaborators")
    .select("email, role")
    .eq("project_id", params.id)
    .order("role");

  const { data: releases } = await service
    .from("releases")
    .select("id, app_name, platform, version, build_number, status, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: deliveries } = await service
    .from("webhook_deliveries")
    .select("id, event, status, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: tokens } = await service
    .from("api_tokens")
    .select("id, label, token_prefix, last_used_at")
    .eq("project_id", params.id);

  return {
    props: {
      project,
      collaborators: collaborators || [],
      releases: releases || [],
      deliveries: deliveries || [],
      tokens: tokens || [],
    },
  };
}

function Section({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {title}
      </div>
      <div className="bg-white dark:bg-slate-900">{children}</div>
    </div>
  );
}

export default function AdminProjectDetail({ project, collaborators, releases, deliveries, tokens }) {
  return (
    <AdminShell>
      <Link href="/projects" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
        <ArrowLeft size={12} />
        Back to projects
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{project.name}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Created {new Date(project.created_at).toLocaleDateString()} · Webhook:{" "}
        {project.webhook_url ? "configured" : "not set"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={`Collaborators (${collaborators.length})`}>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {collaborators.map((c) => (
              <div key={c.email} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{c.email}</span>
                <span className="text-xs capitalize text-slate-500 dark:text-slate-400">{c.role}</span>
              </div>
            ))}
            {collaborators.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">None.</p>}
          </div>
        </Section>

        <Section title={`API tokens (${tokens.length})`}>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{t.label || t.token_prefix}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t.last_used_at ? `used ${new Date(t.last_used_at).toLocaleDateString()}` : "never used"}
                </span>
              </div>
            ))}
            {tokens.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">None.</p>}
          </div>
        </Section>

        <Section title={`Releases (${releases.length})`}>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {releases.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {r.app_name || "Build"} v{r.version}
                  {r.build_number ? ` (${r.build_number})` : ""} · {r.platform}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{r.status}</span>
              </div>
            ))}
            {releases.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">None.</p>}
          </div>
        </Section>

        <Section title={`Recent webhook deliveries (${deliveries.length})`}>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{d.event}</span>
                <Badge tone={d.status === "success" ? "success" : "danger"}>{d.status}</Badge>
              </div>
            ))}
            {deliveries.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">None.</p>}
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
