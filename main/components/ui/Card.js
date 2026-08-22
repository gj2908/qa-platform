export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Optional structural sub-components for pages that want a consistent
// heading block instead of hand-rolling their own inside a bare <Card>.
// Purely additive — every existing bare `<Card>` usage is unaffected.
Card.Header = function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-border p-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

Card.Title = function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 className={`text-sm font-semibold text-ink-primary ${className}`} {...props}>
      {children}
    </h3>
  );
};

Card.Description = function CardDescription({ className = "", children, ...props }) {
  return (
    <p className={`mt-0.5 text-xs text-ink-tertiary ${className}`} {...props}>
      {children}
    </p>
  );
};
