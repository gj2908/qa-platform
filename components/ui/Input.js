export default function Input({ className = "", error = false, ...props }) {
  return (
    <input
      className={`h-9 w-full rounded-md border bg-surface px-3 text-sm text-ink-primary placeholder:text-ink-tertiary transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        error
          ? "border-danger focus:border-danger focus:ring-danger/20"
          : "border-border focus:border-accent focus:ring-accent/20"
      } ${className}`}
      {...props}
    />
  );
}
