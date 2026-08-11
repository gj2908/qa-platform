import Link from "next/link";

export default function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent-subtle text-accent-subtle-fg"
          : "text-ink-tertiary hover:bg-hover hover:text-ink-primary"
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {label}
    </Link>
  );
}
