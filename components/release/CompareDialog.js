import { X, ArrowRight } from "lucide-react";
import AppIcon from "./AppIcon";
import { formatBytes } from "../../lib/format";

// Simple line-set diff — good enough for comparing two changelog entries;
// a full LCS/Myers algorithm would be overkill for short release notes.
function diffLines(oldText, newText) {
  const oldLines = (oldText || "").split("\n").filter((l) => l.trim());
  const newLines = (newText || "").split("\n").filter((l) => l.trim());
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const removed = oldLines.filter((l) => !newSet.has(l));
  const added = newLines.filter((l) => !oldSet.has(l));
  const unchanged = newLines.filter((l) => oldSet.has(l));

  return { added, removed, unchanged };
}

export default function CompareDialog({ releases, open, onClose }) {
  if (!open || !releases || releases.length !== 2) return null;

  // Older first, so the diff reads as "what changed since then".
  const [a, b] = [...releases].sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
  const sizeDelta = a.file_size_bytes && b.file_size_bytes ? b.file_size_bytes - a.file_size_bytes : null;
  const { added, removed, unchanged } = diffLines(a.notes, b.notes);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-neutral-950/50" onClick={onClose} aria-hidden="true" />
      <div
        data-testid="compare-dialog"
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-primary">Compare releases</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <AppIcon src={a.app_icon} fallbackLabel={a.app_name} size={24} />
              <span className="text-sm font-medium text-ink-primary">
                v{a.version}
                {a.build_number ? ` (${a.build_number})` : ""}
              </span>
            </div>
            <ArrowRight size={14} className="shrink-0 text-ink-tertiary" />
            <div className="flex items-center gap-2">
              <AppIcon src={b.app_icon} fallbackLabel={b.app_name} size={24} />
              <span className="text-sm font-medium text-ink-primary">
                v{b.version}
                {b.build_number ? ` (${b.build_number})` : ""}
              </span>
            </div>
          </div>

          {sizeDelta !== null && (
            <div className="rounded-md bg-subtle px-3.5 py-2.5 text-sm text-ink-secondary">
              Size: {formatBytes(a.file_size_bytes)} → {formatBytes(b.file_size_bytes)} (
              <span className={sizeDelta > 0 ? "text-danger" : sizeDelta < 0 ? "text-success" : ""}>
                {sizeDelta > 0 ? "+" : ""}
                {formatBytes(Math.abs(sizeDelta))}
              </span>
              )
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">Notes diff</h3>
            <div className="mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-canvas p-3 font-mono text-xs">
              {added.length === 0 && removed.length === 0 && unchanged.length === 0 && (
                <p className="text-ink-tertiary">No notes on either release.</p>
              )}
              {removed.map((line, i) => (
                <p key={`r${i}`} className="text-danger">
                  − {line}
                </p>
              ))}
              {added.map((line, i) => (
                <p key={`a${i}`} className="text-success">
                  + {line}
                </p>
              ))}
              {unchanged.map((line, i) => (
                <p key={`u${i}`} className="text-ink-tertiary">
                  &nbsp;&nbsp;{line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
