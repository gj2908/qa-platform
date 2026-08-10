import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import TaskCard from "../../../components/TaskCard";

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });

  if (!project) return { notFound: true };
  return { props: { project, tasks: tasks || [] } };
}

export default function Board({ project, tasks: initialTasks }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const router = useRouter();

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tasks")
      .insert({ project_id: project.id, title, status: "backlog", created_by: user.id })
      .select()
      .single();
    setTasks([...tasks, data]);
    setTitle("");
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

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← All projects</Link>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{project.name}</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
          <Link href={`/projects/${project.id}/changelog`}>Changelog</Link>
          <Link href={`/projects/${project.id}/new-release`}>New release</Link>
        </div>
      </div>

      <form onSubmit={addTask} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{ padding: "10px 16px", borderRadius: 6, background: "#111", color: "#fff", border: "none" }}>
          Add task
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`, gap: 12 }}>
        {COLUMNS.map((col) => (
          <div key={col.key} style={{ background: "#f0f0f0", borderRadius: 8, padding: 10, minHeight: 300 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#555" }}>
              {col.label} ({tasks.filter((t) => t.status === col.key).length})
            </div>
            {tasks
              .filter((t) => t.status === col.key)
              .map((t) => (
                <TaskCard key={t.id} task={t} onMove={moveTask} onDelete={deleteTask} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
