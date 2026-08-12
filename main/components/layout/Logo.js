import { Boxes } from "lucide-react";

export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
        <Boxes size={16} strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="truncate text-sm font-semibold tracking-tight text-ink-primary">
          QA Platform
        </span>
      )}
    </div>
  );
}
