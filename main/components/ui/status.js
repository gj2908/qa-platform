// Shared kanban status metadata — dot color, subtle badge classes, and
// left-edge accent classes, keyed so Tailwind can statically see every
// class name used (no dynamic `bg-status-${x}` interpolation).
export const STATUS_META = {
  backlog: {
    label: "Backlog",
    dot: "bg-status-backlog",
    badge: "bg-status-backlog-bg text-status-backlog-fg",
    accent: "border-l-status-backlog",
  },
  todo: {
    label: "To Do",
    dot: "bg-status-todo",
    badge: "bg-status-todo-bg text-status-todo-fg",
    accent: "border-l-status-todo",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-status-inprogress",
    badge: "bg-status-inprogress-bg text-status-inprogress-fg",
    accent: "border-l-status-inprogress",
  },
  review: {
    label: "Review",
    dot: "bg-status-review",
    badge: "bg-status-review-bg text-status-review-fg",
    accent: "border-l-status-review",
  },
  done: {
    label: "Done",
    dot: "bg-status-done",
    badge: "bg-status-done-bg text-status-done-fg",
    accent: "border-l-status-done",
  },
};

export const STATUS_ORDER = ["backlog", "todo", "in_progress", "review", "done"];
