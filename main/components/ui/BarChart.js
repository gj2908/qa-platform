// Minimal inline-SVG bar chart — no charting library in this app, and a
// day-by-day install trend / version-adoption breakdown doesn't need
// one. `data` is [{ label, value }]; bars are scaled to the tallest one.
export default function BarChart({ data, height = 100 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / Math.max(data.length, 1);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-tertiary">Not enough data yet.</p>;
  }

  return (
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
  );
}
