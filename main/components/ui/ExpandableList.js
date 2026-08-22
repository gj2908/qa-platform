import { useState } from "react";

// Shared "show N, then see more" pattern — extracted from the org
// dashboard's original inline implementation. Caller owns sorting/capping
// of `items` and all per-item markup via `renderItem`; this component only
// owns the show-all toggle, so it works equally for activity-log rows and
// collaborator rows despite their different shapes/markup.
export default function ExpandableList({
  items,
  renderItem,
  visibleCount = 5,
  moreLabel,
  lessLabel = "Show less",
  className = "",
  toggleClassName = "mt-3 text-xs font-medium text-accent hover:text-accent-hover",
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, visibleCount);
  const remaining = items.length - visibleCount;

  return (
    <>
      <div className={className}>{visible.map(renderItem)}</div>
      {remaining > 0 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className={toggleClassName}>
          {showAll ? lessLabel : moreLabel || `View ${remaining} more`}
        </button>
      )}
    </>
  );
}
