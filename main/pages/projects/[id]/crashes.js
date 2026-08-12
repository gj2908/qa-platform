import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import { relativeTime } from "../../../lib/format";
import { Bug, ChevronDown, ChevronRight } from "lucide-react";

const MAX_REPORTS_SCANNED = 500;

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  if (!role) return { notFound: true };

  const { data: reportsRaw } = await supabase
    .from("crash_reports")
    .select("signature, exception_type, message, stack_trace, app_version, build_number, platform, device_model, os_version, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(MAX_REPORTS_SCANNED);

  const reports = reportsRaw || [];
  const groups = {};
  for (const r of reports) {
    if (!groups[r.signature]) {
      groups[r.signature] = {
        signature: r.signature,
        exceptionType: r.exception_type,
        message: r.message,
        platform: r.platform,
        stackTrace: r.stack_trace,
        versions: new Set(),
        count: 0,
        firstSeen: r.created_at,
        lastSeen: r.created_at,
      };
    }
    const g = groups[r.signature];
    g.count += 1;
    g.versions.add(r.app_version ? `${r.app_version}${r.build_number ? ` (${r.build_number})` : ""}` : "unknown");
    if (r.created_at < g.firstSeen) g.firstSeen = r.created_at;
    if (r.created_at > g.lastSeen) {
      g.lastSeen = r.created_at;
      // Keep the most recent report's message/stack as the representative sample.
      g.message = r.message;
      g.stackTrace = r.stack_trace;
    }
  }

  const crashGroups = Object.values(groups)
    .map((g) => ({ ...g, versions: Array.from(g.versions) }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  return { props: { project, role, crashGroups, truncated: reports.length >= MAX_REPORTS_SCANNED } };
}

export default function ProjectCrashes({ project, crashGroups, truncated }) {
  return (
    <ProjectShell project={project} active="crashes">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Crashes</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            Grouped by exception type + stack signature. Raw stack traces only — no automatic symbolication, so
            release-build stack addresses may need manual symbolication with your own dSYM/mapping files.
          </p>
        </div>

        {truncated && (
          <p className="text-xs text-ink-tertiary">
            Showing groups from the most recent {MAX_REPORTS_SCANNED} reports.
          </p>
        )}

        {crashGroups.length === 0 ? (
          <EmptyState
            icon={Bug}
            title="No crashes reported"
            description={`POST to /api/public/crash-report with a releaseId to start tracking crashes for this project.`}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {crashGroups.map((g) => (
              <CrashGroupCard key={g.signature} group={g} />
            ))}
          </div>
        )}
      </div>
    </ProjectShell>
  );
}

function CrashGroupCard({ group }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-hover"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-ink-tertiary" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-ink-tertiary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-primary">{group.exceptionType}</p>
            {group.message && <p className="truncate text-xs text-ink-tertiary">{group.message}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="danger">{group.count}×</Badge>
          <span className="text-xs text-ink-tertiary">{relativeTime(group.lastSeen)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <dl className="grid grid-cols-2 gap-2 text-xs text-ink-tertiary sm:grid-cols-4">
            <div>
              <dt className="font-medium text-ink-secondary">Platform</dt>
              <dd>{group.platform}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-secondary">First seen</dt>
              <dd>{relativeTime(group.firstSeen)}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-secondary">Last seen</dt>
              <dd>{relativeTime(group.lastSeen)}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-secondary">Versions affected</dt>
              <dd className="truncate">{group.versions.join(", ")}</dd>
            </div>
          </dl>
          {group.stackTrace && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-subtle px-3 py-2.5 text-xs text-ink-secondary">
              {group.stackTrace}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}
