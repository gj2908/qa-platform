import { useMemo, useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import TaskDetailDialog from "../../../components/TaskDetailDialog";
import ProjectShell from "../../../components/layout/ProjectShell";
import Button from "../../../components/ui/Button";
import { STATUS_META } from "../../../components/ui/status";
import { canManageBoard } from "../../../components/ui/role";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Same auth/fetch shape as board.js — full tasks query for the project
// (not narrowed to `due_date is not null` server-side), filtered
// client-side below. Keeps this page consistent with board.js rather
// than adding a second, slightly-different tasks query for one view.
export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", params.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const { data: collaboratorsRaw } = await supabase
    .from("project_collaborators")
    .select("email")
    .eq("project_id", params.id);

  const collaborators = collaboratorsRaw || [];
  const emails = [...new Set(collaborators.map((c) => c.email))];
  let nameByEmail = {};
  if (emails.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("email, full_name").in("email", emails);
    nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));
  }
  const collaboratorsWithNames = collaborators.map((c) => ({ email: c.email, full_name: nameByEmail[c.email] || null }));

  return {
    props: {
      project,
      role,
      tasks: tasks || [],
      collaborators: collaboratorsWithNames,
      nameByEmail,
    },
  };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n) {
  return String(n).padStart(2, "0");
}

// `due_date` is stored as a plain "YYYY-MM-DD" string (see TaskCard.js's
// dueDateStatus, which parses it the same way) — building grid cell keys
// in the same string shape lets us match on it directly with no Date
// round-trip / timezone drift.
function dateKey(year, month, day) {
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Always 42 cells (6 full weeks) so the grid's height is stable across
// months regardless of how many rows a given month actually needs.
// Leading/trailing cells spill into the previous/next month the same
// way `new Date(year, month, dayOffset)` naturally normalizes.
function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayOffset = i - firstWeekday + 1;
    const cellDate = new Date(year, month, dayOffset);
    cells.push({
      key: dateKey(year, month, dayOffset),
      day: cellDate.getDate(),
      currentMonth: cellDate.getMonth() === month,
    });
  }
  return cells;
}

export default function Calendar({ project, role, tasks: initialTasks, collaborators, nameByEmail }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const canEdit = canManageBoard(role);

  const todayKey = useMemo(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!map[t.due_date]) map[t.due_date] = [];
      map[t.due_date].push(t);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => buildMonthGrid(viewDate.year, viewDate.month), [viewDate]);
  const dueCount = tasks.filter((t) => t.due_date).length;

  function goPrevMonth() {
    setViewDate(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  }
  function goNextMonth() {
    setViewDate(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  }
  function goToday() {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  }

  async function saveTaskDetails(task, fields) {
    const supabase = createClient();
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    await supabase.from("tasks").update(fields).eq("id", task.id);
  }

  async function deleteTask(task) {
    const supabase = createClient();
    setTasks(tasks.filter((t) => t.id !== task.id));
    setSelectedTask(null);
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  const monthLabel = new Date(viewDate.year, viewDate.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <ProjectShell project={project} active="calendar" role={role}>
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">{project.name}</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              {dueCount} task{dueCount === 1 ? "" : "s"} with a due date
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={goToday}>
              Today
            </Button>
            <div className="flex items-center rounded-md border border-border">
              <button
                onClick={goPrevMonth}
                className="rounded-l-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary"
                aria-label="Previous month"
              >
                <ChevronLeft size={15} strokeWidth={2.25} />
              </button>
              <span className="min-w-[9rem] border-x border-border px-3 py-1.5 text-center text-sm font-medium text-ink-primary">
                {monthLabel}
              </span>
              <button
                onClick={goNextMonth}
                className="rounded-r-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary"
                aria-label="Next month"
              >
                <ChevronRight size={15} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,1fr)] gap-px overflow-hidden rounded-lg border border-border bg-border">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-subtle px-2 py-1.5 text-center text-xs font-medium text-ink-tertiary">
              {label}
            </div>
          ))}
          {cells.map((cell) => {
            const dayTasks = tasksByDate[cell.key] || [];
            const isToday = cell.key === todayKey;
            return (
              <div
                key={cell.key}
                className={`flex min-h-0 flex-col gap-1 overflow-y-auto thin-scrollbar p-1.5 ${
                  cell.currentMonth ? "bg-surface" : "bg-subtle"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? "bg-accent text-accent-fg" : cell.currentMonth ? "text-ink-secondary" : "text-ink-disabled"
                  }`}
                >
                  {cell.day}
                </span>
                <div className="flex flex-col gap-1">
                  {dayTasks.map((t) => {
                    const meta = STATUS_META[t.status];
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        title={t.title}
                        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${meta.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className="truncate">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailDialog
        task={selectedTask}
        collaborators={collaborators}
        nameByEmail={nameByEmail}
        editable={canEdit}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={saveTaskDetails}
        onDelete={deleteTask}
      />
    </ProjectShell>
  );
}
