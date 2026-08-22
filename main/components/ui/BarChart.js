// Minimal inline-SVG bar chart — no charting library in this app, and a
// day-by-day install trend / version-adoption breakdown doesn't need
// one. `data` is [{ label, value }]; bars are scaled to the tallest one.
// Pass `formatLabel` to render the first/last bucket's label underneath
// the chart (e.g. a date range) — the only way to tell which bar is which
// otherwise is an SVG hover tooltip, which nobody discovers on their own.
export default function BarChart({ data, height = 100, formatLabel }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / Math.max(data.length, 1);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-tertiary">Not enough data yet.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = max > 0 ? (d.value / max) * (height - 4) : 0;
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              rx="1"
              className="fill-accent"
            >
              <title>
                {d.label}: {d.value}
              </title>
            </rect>
          );
        })}
      </svg>
      {formatLabel && data.length > 1 && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-ink-tertiary">
          <span>{formatLabel(data[0].label)}</span>
          <span>{formatLabel(data[data.length - 1].label)}</span>
        </div>
      )}
    </div>
  );
}
