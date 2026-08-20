import { ChevronLeft, ChevronRight, CalendarClock, GripVertical, Sparkles, Trash2 } from "lucide-react";
import { STATUS_META, STATUS_ORDER } from "./ui/status";
import { getAvatarColor } from "../lib/avatarColor";

const AI_CATEGORY_TONE = {
  bug: "bg-danger-subtle text-danger-subtle-fg",
  feature: "bg-accent-subtle text-accent-subtle-fg",
  question: "bg-subtle text-ink-tertiary",
};

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

export default function TaskCard({
  task,
  assigneeName,
  onMove,
  onDelete,
  onOpen,
  editable = true,
  draggableProps = {},
  selectMode = false,
  selected = false,
  onToggleSelect,
}) {
  const idx = STATUS_ORDER.indexOf(task.status);
  const meta = STATUS_META[task.status];
  const dueStatus = dueDateStatus(task.due_date);
  const assigneeColor = task.assignee_email ? getAvatarColor(task.assignee_email) : null;
  const assigneeDisplay = assigneeName || task.assignee_email;

  function handleDragStart(e) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable={editable && !selectMode}
      onDragStart={editable && !selectMode ? handleDragStart : undefined}
      onClick={() => (selectMode ? onToggleSelect?.(task) : onOpen?.(task))}
      className={`group flex cursor-pointer flex-col gap-2 rounded-md border border-l-[3px] bg-surface p-3 shadow-sm transition-shadow hover:shadow-md ${meta.accent} ${
        selected ? "border-accent ring-1 ring-accent" : "border-border"
      }`}
      {...draggableProps}
    >
      <div className="flex items-start gap-1.5">
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(task)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-accent"
          />
        )}
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink-primary">
          {task.title}
        </p>
        {editable && !selectMode && (
          <GripVertical
            size={14}
            className="mt-0.5 shrink-0 cursor-grab text-ink-disabled opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-tertiary">{task.description}</p>
      )}

      {task.ai_category && (
        <span
          title="AI-suggested — not verified by a person"
          className={`inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${AI_CATEGORY_TONE[task.ai_category] || AI_CATEGORY_TONE.question}`}
        >
          <Sparkles size={10} strokeWidth={2.25} />
          {task.ai_category}
          {task.ai_severity ? ` · ${task.ai_severity}` : ""}
        </span>
      )}

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

      {(task.assignee_email || dueStatus) && (
        <div className="flex flex-wrap items-center gap-2">
          {task.assignee_email && (
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${assigneeColor.bg} ${assigneeColor.text}`}
              >
                {assigneeDisplay[0].toUpperCase()}
              </span>
              <span className="truncate text-xs text-ink-tertiary">{assigneeDisplay}</span>
            </div>
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
              {new Date(task.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      )}

      {editable && (
        <div className="flex items-center gap-0.5 border-t border-border pt-2">
          <button
            disabled={idx <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onMove(task, STATUS_ORDER[idx - 1]);
            }}
            className="rounded p-1 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft size={13} strokeWidth={2.25} />
          </button>
          <button
            disabled={idx >= STATUS_ORDER.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMove(task, STATUS_ORDER[idx + 1]);
            }}
            className="rounded p-1 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight size={13} strokeWidth={2.25} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
            className="ml-auto rounded p-1 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
          >
            <Trash2 size={13} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}
