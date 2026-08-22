import Card from "./Card";

// Shared "big number" stat card, extracted from pages/dashboard.js so it
// can be reused (e.g. by pages/organizations/index.js's analogous tiles).
// The numeral is set in the mono face — this redesign's signature type
// treatment for anything that counts or versions something.
export default function StatTile({ icon: Icon, label, value, className = "" }) {
  return (
    <Card className={`flex items-center gap-3.5 p-4 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-semibold leading-tight text-ink-primary">{value}</p>
        <p className="truncate text-xs text-ink-tertiary">{label}</p>
      </div>
    </Card>
  );
}
