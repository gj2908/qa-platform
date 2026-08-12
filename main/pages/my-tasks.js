import Link from "next/link";
import { createServerSupabase } from "../lib/supabase/server";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import { STATUS_META } from "../components/ui/status";
import { ListChecks, CalendarClock } from "lucide-react";
import { useState } from "react";

// Cross-project view of everything assigned to the signed-in user. A
// single query — no per-project loop — because RLS's "members read
// tasks" policy already scopes `tasks` to projects the caller belongs
// to, so filtering by assignee_email here can't leak tasks from
// projects they're not a member of.
export async function getServerSideProps({ req, res }) {
  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { props: { tasks: [] } };
  }

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("id, title, status, priority, labels, due_date, project_id")
    .eq("assignee_email", user.email)
    .order("due_date", { ascending: true, nullsFirst: false });

  const projectIds = [...new Set((tasksRaw || []).map((t) => t.project_id))];
  let projectById = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
    projectById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  }

  const tasks = (tasksRaw || [])
    .filter((t) => t.status !== "done")
    .map((t) => ({ ...t, projectName: projectById[t.project_id] || "Unknown project" }));

  return { props: { tasks } };
}

function dueDateStatus(dueDate) {
  if (!dueDate) return null;
  const daysLeft = Math.ceil((new Date(dueDate + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 1) return "soon";
  return "normal";
}

export default function MyTasks({ tasks }) {
  const [hidden, setHidden] = useState(new Set());
  const supabase = createClient();

  async function markDone(task) {
    setHidden((h) => new Set(h).add(task.id));
    await supabase.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", task.id);
  }

  const visible = tasks.filter((t) => !hidden.has(t.id));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-ink-secondary" strokeWidth={2} />
          <h1 className="text-xl font-semibold text-ink-primary">My tasks</h1>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nothing assigned to you"
            description="Tasks assigned to you across every project you're a member of will show up here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((t) => {
              const meta = STATUS_META[t.status];
              const dueStatus = dueDateStatus(t.due_date);
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 rounded-md border border-l-[3px] border-border bg-surface p-3 shadow-sm ${meta.accent}`}
                >
                  <input
                    type="checkbox"
                    onChange={() => markDone(t)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-primary">{t.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
                      <Link href={`/projects/${t.project_id}/board`} className="hover:text-ink-primary hover:underline">
                        {t.projectName}
                      </Link>
                      <span>·</span>
                      <span>{meta.label}</span>
                      {dueStatus && (
                        <span
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            dueStatus === "overdue"
                              ? "bg-danger-subtle text-danger-subtle-fg"
                              : dueStatus === "soon"
                                ? "bg-warning-subtle text-warning-subtle-fg"
                                : "bg-subtle text-ink-tertiary"
                          }`}
                        >
                          <CalendarClock size={10} strokeWidth={2.25} />
                          {new Date(t.due_date + "T00:00:00").toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
