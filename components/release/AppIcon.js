export default function AppIcon({ src, fallbackLabel, size = 44, className = "" }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-lg border border-border object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-sm font-semibold text-accent-subtle-fg ${className}`}
      style={{ width: size, height: size }}
    >
      {fallbackLabel ? fallbackLabel[0].toUpperCase() : "?"}
    </span>
  );
}
