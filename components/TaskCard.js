import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { STATUS_META, STATUS_ORDER } from "./ui/status";

export default function TaskCard({ task, onMove, onDelete }) {
  const idx = STATUS_ORDER.indexOf(task.status);
  const meta = STATUS_META[task.status];

  function handleDragStart(e) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group flex cursor-grab flex-col gap-2 rounded-md border border-l-[3px] border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${meta.accent}`}
    >
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink-primary">
          {task.title}
        </p>
        <GripVertical
          size={14}
          className="mt-0.5 shrink-0 text-ink-disabled opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-tertiary">{task.description}</p>
      )}

      {task.assignee_email && (
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-subtle text-[9px] font-semibold text-ink-tertiary">
            {task.assignee_email[0].toUpperCase()}
          </span>
          <span className="truncate text-xs text-ink-tertiary">{task.assignee_email}</span>
        </div>
      )}

      <div className="flex items-center gap-0.5 border-t border-border pt-2">
        <button
          disabled={idx <= 0}
          onClick={() => onMove(task, STATUS_ORDER[idx - 1])}
          className="rounded p-1 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft size={13} strokeWidth={2.25} />
        </button>
        <button
          disabled={idx >= STATUS_ORDER.length - 1}
          onClick={() => onMove(task, STATUS_ORDER[idx + 1])}
          className="rounded p-1 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight size={13} strokeWidth={2.25} />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="ml-auto rounded p-1 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 size={13} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
