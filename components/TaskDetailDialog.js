import { useEffect, useState } from "react";
import FormField from "./ui/FormField";
import Textarea from "./ui/Textarea";
import Select from "./ui/Select";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { Trash2, X, Send } from "lucide-react";
import { createClient } from "../lib/supabase/client";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getAvatarColor } from "../lib/avatarColor";
import { relativeTime } from "../lib/format";

// Opened by clicking a task card body (not the drag handle or the
// quick status/delete controls) — the quick "New task title" add form
// on the board stays as the fast-capture path; this is where the
// richer fields (description, assignee, due date) and the comment
// thread live.
export default function TaskDetailDialog({ task, collaborators, nameByEmail, editable, open, onClose, onSave, onDelete }) {
  const [description, setDescription] = useState(task?.description || "");
  const [assigneeEmail, setAssigneeEmail] = useState(task?.assignee_email || "");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [priority, setPriority] = useState(task?.priority || "");
  const [labels, setLabels] = useState((task?.labels || []).join(", "));
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!task?.id) return;
    setComments([]);
    const supabase = createClient();
    supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments(data || []));
  }, [task?.id]);

  if (!open || !task) return null;

  async function postComment() {
    const body = commentBody.trim();
    if (!body || !currentUser?.email) return;
    setPostingComment(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ task_id: task.id, project_id: task.project_id, author_email: currentUser.email, body })
      .select()
      .single();
    setPostingComment(false);
    if (error || !data) return;
    setComments((c) => [...c, data]);
    setCommentBody("");

    // Best-effort @mention detection — logs to project_activity so a
    // mentioned collaborator sees it in the shared activity feed/bell,
    // same visibility level as every other event in this app (not a
    // targeted per-user notification).
    try {
      const mentioned = collaborators.filter((c) => c.email !== currentUser.email && body.includes(c.email));
      const excerpt = body.length > 80 ? `${body.slice(0, 77)}...` : body;
      await Promise.all(
        mentioned.map((c) =>
          supabase.from("project_activity").insert({
            project_id: task.project_id,
            actor_email: currentUser.email,
            action: "task_mentioned",
            detail: `${c.email} in "${task.title}": ${excerpt}`,
          })
        )
      );
    } catch (e) {
      // ignored
    }
  }

  async function save() {
    setSaving(true);
    await onSave(task, {
      description: description.trim() || null,
      assignee_email: assigneeEmail || null,
      due_date: dueDate || null,
      priority: priority || null,
      labels: labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-neutral-950/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="min-w-0 truncate text-sm font-semibold text-ink-primary">{task.title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <FormField label="Description" htmlFor="taskDescription">
            <Textarea
              id="taskDescription"
              rows={3}
              placeholder="Add more detail…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!editable}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assignee" htmlFor="taskAssignee">
              <Select
                id="taskAssignee"
                value={assigneeEmail}
                onChange={(e) => setAssigneeEmail(e.target.value)}
                disabled={!editable}
              >
                <option value="">Unassigned</option>
                {collaborators.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Due date" htmlFor="taskDueDate">
              <Input
                id="taskDueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!editable}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" htmlFor="taskPriority">
              <Select
                id="taskPriority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!editable}
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
            <FormField label="Labels" htmlFor="taskLabels">
              <Input
                id="taskLabels"
                placeholder="ui, regression…"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                disabled={!editable}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-xs font-medium text-ink-secondary">
              Comments{comments.length > 0 ? ` (${comments.length})` : ""}
            </p>
            {comments.length > 0 && (
              <div className="flex max-h-48 flex-col gap-2.5 overflow-y-auto thin-scrollbar">
                {comments.map((c) => {
                  const color = getAvatarColor(c.author_email);
                  const displayName = nameByEmail?.[c.author_email] || c.author_email;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}
                      >
                        {displayName[0].toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-ink-primary">{displayName}</span>
                          <span className="text-[11px] text-ink-tertiary">{relativeTime(c.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {editable && (
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  placeholder="Add a comment…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={postComment}
                  loading={postingComment}
                  disabled={!commentBody.trim()}
                  aria-label="Post comment"
                >
                  <Send size={13} strokeWidth={2.25} />
                </Button>
              </div>
            )}
          </div>

          {editable && (
            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <button
                onClick={() => onDelete(task)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-danger transition-colors hover:bg-danger-subtle"
              >
                <Trash2 size={13} strokeWidth={2.25} />
                Delete task
              </button>
              <Button onClick={save} loading={saving}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
