import { ChevronDown } from "lucide-react";

export default function Select({ className = "", children, ...props }) {
  return (
    <div className="relative">
      <select
        className={`h-9 w-full appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-sm text-ink-primary transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
      />
    </div>
  );
}
