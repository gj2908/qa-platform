export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center ${className}`}
    >
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-ink-tertiary">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink-primary">{title}</p>
        {description && <p className="text-sm text-ink-tertiary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
