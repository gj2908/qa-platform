import { createServiceClient } from "../../lib/supabase/server";
import { STATUS_META } from "../../components/ui/status";
import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import EmptyState from "../../components/ui/EmptyState";
import { CalendarClock, Map } from "lucide-react";

// Curated columns only — backlog is pre-triage noise and done is
// changelog territory (already public via /share and /channel), so the
// public roadmap only shows what's actually in flight.
const ROADMAP_STATUSES = ["todo", "in_progress", "review"];

const PRIORITY_TONE = {
  low: "bg-subtle text-ink-tertiary",
  medium: "bg-accent-subtle text-accent-subtle-fg",
  high: "bg-warning-subtle text-warning-subtle-fg",
  urgent: "bg-danger-subtle text-danger-subtle-fg",
};

function dueDateStatus(dueDate) {
  if (!dueDate) return null;
  const daysLeft = Math.ceil((new Date(dueDate + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 1) return "soon";
  return "normal";
}

// Public, no-login page gated by projects.roadmap_token — an unguessable
// token stands in for the RLS role check a visitor doesn't have, same
// shape as /share/[id].js's release id and organizations.invite_token.
// Reads through the service client on purpose (anonymous visitor has no
// role for project_role()-backed policies to authorize).
export async function getServerSideProps({ params }) {
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, roadmap_enabled")
    .eq("roadmap_token", params.token)
    .maybeSingle();

  if (!project || !project.roadmap_enabled) return { notFound: true };

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("title, status, priority, labels, due_date")
    .eq("project_id", project.id)
    .in("status", ROADMAP_STATUSES)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    props: {
      projectName: project.name,
      // Only ever the five fields above make it out of getServerSideProps
      // — no description, assignee_email, or anything else internal.
      tasks: tasksRaw || [],
    },
  };
}

function RoadmapTaskCard({ task }) {
  const meta = STATUS_META[task.status];
  const dueStatus = dueDateStatus(task.due_date);

  return (
    <div className={`flex flex-col gap-2 rounded-md border border-l-[3px] bg-surface p-3 shadow-sm ${meta.accent} border-border`}>
      <p className="text-sm font-medium leading-snug text-ink-primary">{task.title}</p>

      {(task.priority || (task.labels && task.labels.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1">
          {task.priority && (
            <span
              className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_TONE[task.priority] || PRIORITY_TONE.low}`}
            >
              {task.priority}
            </span>
          )}
          {(task.labels || []).map((label) => (
            <span
              key={label}
              className="inline-flex w-fit items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {dueStatus && (
        <span
          className={`flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            dueStatus === "overdue"
              ? "bg-danger-subtle text-danger-subtle-fg"
              : dueStatus === "soon"
                ? "bg-warning-subtle text-warning-subtle-fg"
                : "bg-subtle text-ink-tertiary"
          }`}
        >
          <CalendarClock size={10} strokeWidth={2.25} />
          {new Date(task.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

export default function RoadmapPage({ projectName, tasks }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="flex-1 px-4 pb-16 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">{projectName}</h1>
            <p className="mt-1 text-sm text-ink-tertiary">Public roadmap — read-only</p>
          </div>

          {tasks.length === 0 ? (
            <EmptyState icon={Map} title="Nothing on the roadmap yet" description="Check back soon." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ROADMAP_STATUSES.map((key) => {
                const meta = STATUS_META[key];
                const columnTasks = tasks.filter((t) => t.status === key);
                return (
                  <div key={key} className="flex flex-col rounded-lg border border-border bg-subtle">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        <span className="text-sm font-medium text-ink-primary">{meta.label}</span>
                      </div>
                      <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
                        {columnTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {columnTasks.map((t, i) => (
                        <RoadmapTaskCard key={`${key}-${i}`} task={t} />
                      ))}
                      {columnTasks.length === 0 && (
                        <p className="px-2 py-6 text-center text-xs text-ink-tertiary">No tasks</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
