import Link from "next/link";
import { createServerSupabase } from "../lib/supabase/server";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { STATUS_META } from "../components/ui/status";
import { csvRow } from "../lib/csv";
import { ListChecks, CalendarClock, Download, Users } from "lucide-react";
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
    .select("id, title, status, priority, labels, due_date, project_id, assigned_to_team")
    .or(`assignee_email.eq.${user.email},assigned_to_team.eq.true`)
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

// Groups the same flat list into an agenda: overdue first, then this
// week, then later, then no due date at all — rather than one long list
// sorted only by date, which buries "nothing due" tasks awkwardly.
function groupByWeek(tasks) {
  const groups = { overdue: [], thisWeek: [], later: [], noDate: [] };
  const now = Date.now();
  for (const t of tasks) {
    if (!t.due_date) {
      groups.noDate.push(t);
      continue;
    }
    const daysLeft = Math.ceil((new Date(t.due_date + "T00:00:00").getTime() - now) / 86_400_000);
    if (daysLeft < 0) groups.overdue.push(t);
    else if (daysLeft <= 7) groups.thisWeek.push(t);
    else groups.later.push(t);
  }
  return groups;
}

const GROUP_LABELS = { overdue: "Overdue", thisWeek: "This week", later: "Later", noDate: "No due date" };

function downloadCsv(tasks) {
  let csv = csvRow(["Project", "Title", "Status", "Priority", "Labels", "Due date"]);
  for (const t of tasks) {
    csv += csvRow([t.projectName, t.title, STATUS_META[t.status].label, t.priority || "", (t.labels || []).join("; "), t.due_date || ""]);
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-tasks.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function TaskRow({ t, meta, dueStatus, onDone }) {
  return (
    <div className={`flex items-center gap-3 rounded-md border border-l-[3px] border-border bg-surface p-3 shadow-sm ${meta.accent}`}>
      <input type="checkbox" onChange={onDone} className="h-4 w-4 shrink-0 rounded border-border accent-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-primary">{t.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
          <Link href={`/projects/${t.project_id}/board`} className="hover:text-ink-primary hover:underline">
            {t.projectName}
          </Link>
          <span>·</span>
          <span>{meta.label}</span>
          {t.assigned_to_team && (
            <span className="flex items-center gap-1 rounded bg-accent-subtle px-1.5 py-0.5 text-[10px] font-medium text-accent-subtle-fg">
              <Users size={10} strokeWidth={2.5} />
              Whole team
            </span>
          )}
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
              {new Date(t.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyTasks({ tasks }) {
  const [hidden, setHidden] = useState(new Set());
  const supabase = createClient();

  async function markDone(task) {
    setHidden((h) => new Set(h).add(task.id));
    await supabase.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", task.id);
  }

  const visible = tasks.filter((t) => !hidden.has(t.id));
  const groups = groupByWeek(visible);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-ink-secondary" strokeWidth={2} />
            <h1 className="text-xl font-semibold text-ink-primary">My tasks</h1>
          </div>
          {visible.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => downloadCsv(visible)}>
              <Download size={13} strokeWidth={2.25} />
              Export CSV
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nothing assigned to you"
            description="Tasks assigned to you across every project you're a member of will show up here."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {["overdue", "thisWeek", "later", "noDate"].map((key) =>
              groups[key].length === 0 ? null : (
                <div key={key} className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{GROUP_LABELS[key]}</h2>
                  {groups[key].map((t) => (
                    <TaskRow key={t.id} t={t} meta={STATUS_META[t.status]} dueStatus={dueDateStatus(t.due_date)} onDone={() => markDone(t)} />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
