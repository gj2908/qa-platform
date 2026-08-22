import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import TaskCard from "../../../components/TaskCard";
import TaskDetailDialog from "../../../components/TaskDetailDialog";
import ProjectShell from "../../../components/layout/ProjectShell";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import { STATUS_META, STATUS_ORDER } from "../../../components/ui/status";
import { canManageBoard } from "../../../components/ui/role";
import { Inbox, Plus, Search, Bookmark, LayoutTemplate, CheckSquare, X, Trash2 } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const { data: savedViews } = await supabase
    .from("saved_views")
    .select("*")
    .eq("project_id", params.id)
    .eq("user_id", user?.id || "")
    .order("created_at", { ascending: true });
  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });
  const { data: dependencies } = await supabase
    .from("task_dependencies")
    .select("*")
    .eq("project_id", params.id);

  const collaborators = collaboratorsRaw || [];
  const emails = [...new Set(collaborators.map((c) => c.email))];
  let nameByEmail = {};
  let avatarUrlByEmail = {};
  if (emails.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("email, full_name, avatar_url").in("email", emails);
    nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));
    avatarUrlByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.avatar_url]));
  }
  const collaboratorsWithNames = collaborators.map((c) => ({
    email: c.email,
    full_name: nameByEmail[c.email] || null,
    avatar_url: avatarUrlByEmail[c.email] || null,
  }));

  return {
    props: {
      project,
      role,
      tasks: tasks || [],
      collaborators: collaboratorsWithNames,
      nameByEmail,
      avatarUrlByEmail,
      initialSavedViews: savedViews || [],
      initialTemplates: templates || [],
      initialDependencies: dependencies || [],
    },
  };
}

export default function Board({
  project,
  role,
  tasks: initialTasks,
  collaborators,
  nameByEmail,
  avatarUrlByEmail,
  initialSavedViews,
  initialTemplates,
  initialDependencies,
}) {
  const toast = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [dependencies, setDependencies] = useState(initialDependencies);
  const [blockConfirm, setBlockConfirm] = useState(null); // { count, proceed } while awaiting a soft warn on a done-move with open blockers
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [labelFilter, setLabelFilter] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const canEdit = canManageBoard(role);

  const [savedViews, setSavedViews] = useState(initialSavedViews);
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const [templates, setTemplates] = useState(initialTemplates);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  const [newTemplate, setNewTemplate] = useState(null); // { title, labels, priority } while composing

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Best-effort — never blocks the real mutation it's attached to, same
  // rule as every other activity-logging call site in this app. Fetches
  // the user directly rather than via useCurrentUser()'s async state, so
  // this can't silently no-op if a mutation happens before that hook's
  // getUser() round-trip has resolved.
  async function logTaskActivity(action, detail) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      await supabase.from("project_activity").insert({
        project_id: project.id,
        actor_email: user.email,
        action,
        detail,
      });
    } catch (e) {
      // ignored
    }
  }

  function applyView(view) {
    setSearch(view.filters?.search || "");
    setPriorityFilter(view.filters?.priorityFilter || null);
    setLabelFilter(view.filters?.labelFilter || null);
    setShowViewsMenu(false);
  }

  async function saveCurrentView(e) {
    e.preventDefault();
    if (!newViewName.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("saved_views")
      .insert({
        user_id: user.id,
        project_id: project.id,
        name: newViewName.trim(),
        filters: { search, priorityFilter, labelFilter },
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedViews([...savedViews, data]);
    setNewViewName("");
  }

  async function deleteView(view) {
    const supabase = createClient();
    setSavedViews(savedViews.filter((v) => v.id !== view.id));
    await supabase.from("saved_views").delete().eq("id", view.id);
  }

  async function createFromTemplate(template) {
    setShowTemplatesMenu(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tasks")
      .insert({
        project_id: project.id,
        title: template.title,
        description: template.description,
        labels: template.default_labels || [],
        priority: template.default_priority,
        status: "backlog",
        created_by: user.id,
      })
      .select()
      .single();
    if (data) {
      setTasks([...tasks, data]);
      logTaskActivity("task_created", data.title);
    }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    if (!newTemplate?.title?.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("task_templates")
      .insert({
        project_id: project.id,
        title: newTemplate.title.trim(),
        default_priority: newTemplate.priority || null,
        default_labels: newTemplate.labels
          ? newTemplate.labels.split(",").map((l) => l.trim()).filter(Boolean)
          : [],
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates([...templates, data]);
    setNewTemplate(null);
  }

  function toggleTaskSelect(task) {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulkSetStatus(status) {
    const supabase = createClient();
    const ids = [...selectedIds];
    setTasks(tasks.map((t) => (ids.includes(t.id) ? { ...t, status } : t)));
    await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).in("id", ids);
    exitSelectMode();
  }

  async function notifyTeamAssign(task) {
    if (!task) return;
    fetch("/api/tasks/notify-team-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, taskId: task.id }),
    }).catch(() => {});
  }

  async function bulkSetAssignee(value) {
    const supabase = createClient();
    const ids = [...selectedIds];
    const isTeam = value === "__team__";
    const patch = isTeam
      ? { assignee_email: null, assigned_to_team: true }
      : { assignee_email: value || null, assigned_to_team: false };
    const assignedTasks = tasks.filter((t) => ids.includes(t.id));
    setTasks(tasks.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)));
    await supabase.from("tasks").update(patch).in("id", ids);
    if (isTeam) {
      assignedTasks.forEach((t) => notifyTeamAssign(t));
      logTaskActivity("task_assigned_team", `${ids.length} task${ids.length === 1 ? "" : "s"}`);
    }
    exitSelectMode();
  }

  async function bulkDelete() {
    const supabase = createClient();
    const ids = [...selectedIds];
    setTasks(tasks.filter((t) => !ids.includes(t.id)));
    await supabase.from("tasks").delete().in("id", ids);
    exitSelectMode();
  }

  // Dependency rows where `taskId` is blocked and its blocker hasn't
  // reached 'done' yet — the only thing that drives both the TaskCard
  // indicator and the soft "mark done anyway?" warn below. Soft warn only,
  // matching this app's "RLS + UI hints, not a workflow engine" posture
  // (see supabase/schema.sql's comment on task_dependencies).
  function getOpenBlockers(taskId) {
    return dependencies.filter((d) => {
      if (d.blocked_task_id !== taskId) return false;
      const blocker = tasks.find((t) => t.id === d.blocking_task_id);
      return blocker && blocker.status !== "done";
    });
  }

  const allLabels = [...new Set(tasks.flatMap((t) => t.labels || []))].sort();

  const visibleTasks = tasks.filter((t) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) return false;
    }
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (labelFilter && !(t.labels || []).includes(labelFilter)) return false;
    return true;
  });

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
    logTaskActivity("task_created", title);
  }

  async function moveTask(task, newStatus) {
    if (newStatus === "done" && task.status !== "done") {
      const openBlockers = getOpenBlockers(task.id);
      if (openBlockers.length > 0) {
        setBlockConfirm({ count: openBlockers.length, proceed: () => performMoveTask(task, newStatus) });
        return;
      }
    }
    await performMoveTask(task, newStatus);
  }

  async function performMoveTask(task, newStatus) {
    const supabase = createClient();
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await supabase.from("tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", task.id);
    if (newStatus === "done" && task.status !== "done") {
      logTaskActivity("task_completed", task.title);
    }
  }

  // Reorders within a column by renumbering that column's tasks in steps
  // of 10 (standard fractional-index trick) and persisting the new
  // positions — cross-column drops still just change status via moveTask.
  async function reorderTask(taskId, columnKey, targetIndex) {
    const moved = tasks.find((t) => t.id === taskId);
    if (!moved) return;
    if (columnKey === "done" && moved.status !== "done") {
      const openBlockers = getOpenBlockers(taskId);
      if (openBlockers.length > 0) {
        setBlockConfirm({ count: openBlockers.length, proceed: () => performReorderTask(taskId, columnKey, targetIndex) });
        return;
      }
    }
    await performReorderTask(taskId, columnKey, targetIndex);
  }

  async function performReorderTask(taskId, columnKey, targetIndex) {
    const supabase = createClient();
    const columnTasks = tasks.filter((t) => t.status === columnKey && t.id !== taskId);
    const moved = tasks.find((t) => t.id === taskId);
    if (!moved) return;
    columnTasks.splice(targetIndex, 0, { ...moved, status: columnKey });

    const updates = columnTasks.map((t, i) => ({ id: t.id, position: (i + 1) * 10 }));
    const positionById = Object.fromEntries(updates.map((u) => [u.id, u.position]));

    setTasks(
      tasks.map((t) =>
        t.id in positionById ? { ...t, status: columnKey, position: positionById[t.id] } : t
      )
    );

    await Promise.all(
      updates.map((u) =>
        supabase.from("tasks").update({ position: u.position, status: columnKey }).eq("id", u.id)
      )
    );
    if (columnKey === "done" && moved.status !== "done") {
      logTaskActivity("task_completed", moved.title);
    }
  }

  async function deleteTask(task) {
    const supabase = createClient();
    setTasks(tasks.filter((t) => t.id !== task.id));
    setSelectedTask(null);
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  async function saveTaskDetails(task, fields) {
    const supabase = createClient();
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    await supabase.from("tasks").update(fields).eq("id", task.id);
    if (fields.assigned_to_team && !task.assigned_to_team) {
      logTaskActivity("task_assigned_team", task.title);
      notifyTeamAssign(task);
    } else if (fields.assignee_email && fields.assignee_email !== task.assignee_email) {
      logTaskActivity("task_assigned", `${task.title} → ${fields.assignee_email}`);
    }
  }

  function handleDrop(e, columnKey) {
    e.preventDefault();
    if (!canEdit) return;
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status !== columnKey) {
      moveTask(task, columnKey);
    }
  }

  return (
    <ProjectShell project={project} active="board">
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">{project.name}</h1>
            <p className="mt-1 text-sm text-ink-tertiary">{tasks.length} tasks across the board</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <Input
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 pl-8"
              />
            </div>
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowViewsMenu((v) => !v)}>
                <Bookmark size={13} strokeWidth={2.25} />
                Views
              </Button>
              {showViewsMenu && (
                <div className="absolute right-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface-raised p-1.5 shadow-lg">
                  {savedViews.length === 0 && <p className="px-2 py-1.5 text-xs text-ink-tertiary">No saved views yet.</p>}
                  {savedViews.map((v) => (
                    <div key={v.id} className="group flex items-center gap-1 rounded-md hover:bg-hover">
                      <button onClick={() => applyView(v)} className="flex-1 truncate px-2 py-1.5 text-left text-sm text-ink-primary">
                        {v.name}
                      </button>
                      <button
                        onClick={() => deleteView(v)}
                        className="mr-1 rounded p-1 text-ink-tertiary opacity-0 hover:bg-danger-subtle hover:text-danger group-hover:opacity-100"
                      >
                        <X size={12} strokeWidth={2.25} />
                      </button>
                    </div>
                  ))}
                  <form onSubmit={saveCurrentView} className="mt-1 flex gap-1 border-t border-border pt-1.5">
                    <Input
                      placeholder="Save current filters as…"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      className="h-7 flex-1 text-xs"
                    />
                    <Button type="submit" size="sm" disabled={!newViewName.trim()}>
                      Save
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="relative">
                <Button variant="secondary" size="sm" onClick={() => setShowTemplatesMenu((v) => !v)}>
                  <LayoutTemplate size={13} strokeWidth={2.25} />
                  Templates
                </Button>
                {showTemplatesMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface-raised p-1.5 shadow-lg">
                    {templates.length === 0 && <p className="px-2 py-1.5 text-xs text-ink-tertiary">No templates yet.</p>}
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => createFromTemplate(t)}
                        className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-ink-primary hover:bg-hover"
                      >
                        {t.title}
                      </button>
                    ))}
                    <div className="mt-1 border-t border-border pt-1.5">
                      {newTemplate ? (
                        <form onSubmit={saveTemplate} className="flex flex-col gap-1.5">
                          <Input
                            autoFocus
                            placeholder="Template title"
                            value={newTemplate.title || ""}
                            onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                            className="h-7 text-xs"
                          />
                          <Input
                            placeholder="Labels, comma separated"
                            value={newTemplate.labels || ""}
                            onChange={(e) => setNewTemplate({ ...newTemplate, labels: e.target.value })}
                            className="h-7 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button type="button" variant="secondary" size="sm" onClick={() => setNewTemplate(null)}>
                              Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={!newTemplate.title?.trim()}>
                              Save
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setNewTemplate({ title: "", labels: "" })}
                          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-accent hover:bg-hover"
                        >
                          <Plus size={13} strokeWidth={2.25} />
                          New template
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <Button
                variant={selectMode ? "primary" : "secondary"}
                size="sm"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              >
                <CheckSquare size={13} strokeWidth={2.25} />
                {selectMode ? `${selectedIds.size} selected` : "Select"}
              </Button>
            )}

            {canEdit && !selectMode && (
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
        </div>

        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2">
            <span className="text-xs font-medium text-ink-tertiary">Bulk actions for {selectedIds.size} task{selectedIds.size === 1 ? "" : "s"}:</span>
            <Select
              value=""
              onChange={(e) => e.target.value && bulkSetStatus(e.target.value)}
              disabled={selectedIds.size === 0}
              className="h-7 w-auto text-xs"
            >
              <option value="">Set status…</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Select
              value=""
              onChange={(e) => e.target.value && bulkSetAssignee(e.target.value === "__none__" ? "" : e.target.value)}
              disabled={selectedIds.size === 0}
              className="h-7 w-auto text-xs"
            >
              <option value="">Set assignee…</option>
              <option value="__none__">Unassigned</option>
              <option value="__team__">Whole team</option>
              {collaborators.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.full_name || c.email}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" disabled={selectedIds.size === 0} onClick={bulkDelete}>
              <Trash2 size={13} strokeWidth={2.25} />
              Delete
            </Button>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={exitSelectMode}>
              Cancel
            </Button>
          </div>
        )}

        {(allLabels.length > 0 || tasks.some((t) => t.priority)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {["low", "medium", "high", "urgent"].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
                  priorityFilter === p
                    ? "border-accent bg-accent-subtle text-accent-subtle-fg"
                    : "border-border text-ink-tertiary hover:bg-hover"
                }`}
              >
                {p}
              </button>
            ))}
            {allLabels.map((label) => (
              <button
                key={label}
                onClick={() => setLabelFilter(labelFilter === label ? null : label)}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                  labelFilter === label
                    ? "border-accent bg-accent-subtle text-accent-subtle-fg"
                    : "border-border text-ink-tertiary hover:bg-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-x-auto pb-1 thin-scrollbar">
          <div className="flex h-full min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-5">
            {STATUS_ORDER.map((key) => {
              const meta = STATUS_META[key];
              const columnTasks = visibleTasks.filter((t) => t.status === key);
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
                      {columnTasks.map((t, i) => (
                        <div
                          key={t.id}
                          onDragOver={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const taskId = e.dataTransfer.getData("text/plain");
                            if (taskId === t.id) return;
                            reorderTask(taskId, key, i);
                          }}
                        >
                          <TaskCard
                            task={t}
                            assigneeName={t.assignee_email ? nameByEmail[t.assignee_email] : null}
                            assigneeAvatarUrl={t.assignee_email ? avatarUrlByEmail[t.assignee_email] : null}
                            onMove={moveTask}
                            onDelete={deleteTask}
                            onOpen={setSelectedTask}
                            editable={canEdit}
                            selectMode={selectMode}
                            selected={selectedIds.has(t.id)}
                            onToggleSelect={toggleTaskSelect}
                            openBlockerCount={getOpenBlockers(t.id).length}
                          />
                        </div>
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

      <TaskDetailDialog
        task={selectedTask}
        collaborators={collaborators}
        nameByEmail={nameByEmail}
        editable={canEdit}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={saveTaskDetails}
        onDelete={deleteTask}
        allTasks={tasks}
        dependencies={dependencies}
        onDependencyAdded={(dep) => setDependencies((deps) => [...deps, dep])}
        onDependencyRemoved={(depId) => setDependencies((deps) => deps.filter((d) => d.id !== depId))}
      />

      <ConfirmDialog
        open={!!blockConfirm}
        title={`${blockConfirm?.count || 0} blocker${blockConfirm?.count === 1 ? "" : "s"} aren't done yet`}
        description="You can still mark this task done — nothing blocks the status change, this is just a heads up."
        confirmLabel="Mark done anyway"
        onConfirm={() => {
          const proceed = blockConfirm?.proceed;
          setBlockConfirm(null);
          proceed?.();
        }}
        onCancel={() => setBlockConfirm(null)}
      />
    </ProjectShell>
  );
}
