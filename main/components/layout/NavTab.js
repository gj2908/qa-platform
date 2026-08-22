import Link from "next/link";

// Same element renders in two contexts: stacked full-width inside the
// mobile Sheet (base styles) and as an underline tab in TopNav's desktop
// center nav (sm: overrides) — the nav array is built once in ProjectShell
// and passed to both, so the component has to work in both shapes rather
// than needing a `variant` prop or a container-side style override.
export default function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:h-full sm:gap-1.5 sm:rounded-none sm:border-b-2 sm:px-3 sm:py-0 ${
        active
          ? "bg-accent-subtle text-accent-subtle-fg sm:border-accent sm:bg-transparent sm:text-ink-primary"
          : "text-ink-secondary hover:bg-hover hover:text-ink-primary sm:border-transparent sm:text-ink-tertiary sm:hover:border-border-strong sm:hover:bg-transparent"
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {label}
    </Link>
  );
}
