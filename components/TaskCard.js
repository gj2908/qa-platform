const STATUSES = ["backlog", "todo", "in_progress", "review", "done"];

export default function TaskCard({ task, onMove, onDelete }) {
  const idx = STATUSES.indexOf(task.status);

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.title}</div>
      {task.description && (
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{task.description}</div>
      )}
      {task.assignee_email && (
        <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>{task.assignee_email}</div>
      )}
      <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
        {idx > 0 && (
          <button onClick={() => onMove(task, STATUSES[idx - 1])} style={btnStyle}>
            ←
          </button>
        )}
        {idx < STATUSES.length - 1 && (
          <button onClick={() => onMove(task, STATUSES[idx + 1])} style={btnStyle}>
            →
          </button>
        )}
        <button onClick={() => onDelete(task)} style={{ ...btnStyle, marginLeft: "auto", color: "crimson" }}>
          delete
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  border: "1px solid #ddd",
  background: "#fafafa",
  borderRadius: 4,
  padding: "2px 8px",
};
