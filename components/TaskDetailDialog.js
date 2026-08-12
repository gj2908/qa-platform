import { useState } from "react";
import FormField from "./ui/FormField";
import Textarea from "./ui/Textarea";
import Select from "./ui/Select";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { Trash2, X } from "lucide-react";

// Opened by clicking a task card body (not the drag handle or the
// quick status/delete controls) — the quick "New task title" add form
// on the board stays as the fast-capture path; this is where the
// richer fields (description, assignee, due date) get set.
export default function TaskDetailDialog({ task, collaborators, editable, open, onClose, onSave, onDelete }) {
  const [description, setDescription] = useState(task?.description || "");
  const [assigneeEmail, setAssigneeEmail] = useState(task?.assignee_email || "");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [priority, setPriority] = useState(task?.priority || "");
  const [labels, setLabels] = useState((task?.labels || []).join(", "));
  const [saving, setSaving] = useState(false);

  if (!open || !task) return null;

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
