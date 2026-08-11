import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import TaskCard from "../../../components/TaskCard";
import ProjectShell from "../../../components/layout/ProjectShell";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { STATUS_META, STATUS_ORDER } from "../../../components/ui/status";
import { canManageBoard } from "../../../components/ui/role";
import { Inbox, Plus } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });

  return { props: { project, role, tasks: tasks || [] } };
}

export default function Board({ project, role, tasks: initialTasks }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const canEdit = canManageBoard(role);

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tasks")
      .insert({ project_id: project.id, title, status: "backlog", created_by: user.id })
      .select()
      .single();
    setTasks([...tasks, data]);
    setTitle("");
    setAdding(false);
  }

  async function moveTask(task, newStatus) {
    const supabase = createClient();
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await supabase.from("tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", task.id);
  }

  async function deleteTask(task) {
    const supabase = createClient();
    setTasks(tasks.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  function handleDrop(e, columnKey) {
    e.preventDefault();
    if (!canEdit) return;
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== columnKey) moveTask(task, columnKey);
  }

  return (
    <ProjectShell project={project} active="board">
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">{project.name}</h1>
            <p className="mt-1 text-sm text-ink-tertiary">{tasks.length} tasks across the board</p>
          </div>
          {canEdit && (
            <form onSubmit={addTask} className="flex gap-2">
              <Input
                placeholder="New task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-56"
              />
              <Button type="submit" loading={adding} disabled={!title.trim()}>
                <Plus size={15} strokeWidth={2.25} />
                Add task
              </Button>
            </form>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto pb-1 thin-scrollbar">
          <div className="flex h-full min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-5">
            {STATUS_ORDER.map((key) => {
              const meta = STATUS_META[key];
              const columnTasks = tasks.filter((t) => t.status === key);
              return (
                <div
                  key={key}
                  onDragOver={(e) => canEdit && e.preventDefault()}
                  onDrop={(e) => handleDrop(e, key)}
                  className="flex w-[270px] shrink-0 flex-col rounded-lg border border-border bg-subtle lg:w-auto"
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      <span className="text-sm font-medium text-ink-primary">{meta.label}</span>
                    </div>
                    <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs font-medium leading-none text-ink-tertiary">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto thin-scrollbar px-2 py-2">
                    <div className="flex flex-col gap-2">
                      {columnTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          onMove={moveTask}
                          onDelete={deleteTask}
                          editable={canEdit}
                        />
                      ))}
                      {columnTasks.length === 0 && (
                        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border py-8 text-center">
                          <Inbox size={16} className="text-ink-disabled" strokeWidth={1.75} />
                          <p className="text-xs text-ink-tertiary">No tasks</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ProjectShell>
  );
}
