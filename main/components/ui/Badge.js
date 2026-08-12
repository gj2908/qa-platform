const TONES = {
  neutral: "bg-subtle text-ink-secondary",
  success: "bg-success-subtle text-success-subtle-fg",
  warning: "bg-warning-subtle text-warning-subtle-fg",
  danger: "bg-danger-subtle text-danger-subtle-fg",
  accent: "bg-accent-subtle text-accent-subtle-fg",
};

export default function Badge({ tone = "neutral", icon: Icon, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-none ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}
