import { cn } from "../../lib/utils";

export default function Card({ className = "", children, ...props }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface", className)} {...props}>
      {children}
    </div>
  );
}

// Optional structural sub-components for pages that want a consistent
// heading block instead of hand-rolling their own inside a bare <Card>.
// Purely additive — every existing bare `<Card>` usage is unaffected. Use
// `cn()` (clsx + tailwind-merge, already in the app for the shadcn/Radix
// primitives) rather than raw string concatenation, so a caller's
// `className` can actually override a default like the border or padding
// instead of just appending a conflicting utility that may or may not win.
Card.Header = function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border p-4", className)} {...props}>
      {children}
    </div>
  );
};

Card.Title = function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 className={cn("text-sm font-semibold text-ink-primary", className)} {...props}>
      {children}
    </h3>
  );
};

Card.Description = function CardDescription({ className = "", children, ...props }) {
  return (
    <p className={cn("mt-0.5 text-xs text-ink-tertiary", className)} {...props}>
      {children}
    </p>
  );
};
