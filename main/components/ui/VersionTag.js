// The redesign's signature motif: a small monospace chip for a version or
// build number, styled after a git tag — status dot + `vX.Y.Z` — used
// anywhere a release version appears (project cards, uploads, changelog)
// instead of ad hoc `v{version}` string interpolation.
const DOT_CLASSES = {
  neutral: "bg-ink-disabled",
  accent: "bg-accent",
  success: "bg-success",
};

export default function VersionTag({ version, tone = "neutral", className = "" }) {
  if (!version) return null;
  const label = String(version).startsWith("v") ? version : `v${version}`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border border-border bg-subtle px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-ink-secondary ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone] || DOT_CLASSES.neutral}`} />
      {label}
    </span>
  );
}
