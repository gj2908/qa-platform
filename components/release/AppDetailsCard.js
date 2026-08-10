import Card from "../ui/Card";
import { formatBytes } from "../../lib/format";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-ink-tertiary">{label}</span>
      <span className="truncate font-medium text-ink-primary">{value}</span>
    </div>
  );
}

export default function AppDetailsCard({ release }) {
  const rows = [
    {
      label: release.platform === "android" ? "Package" : "Bundle identifier",
      value: release.bundle_id,
    },
    {
      label: "Version",
      value: release.build_number ? `${release.version} (${release.build_number})` : release.version,
    },
    { label: "Minimum OS", value: release.min_os_version },
    { label: "Size", value: formatBytes(release.file_size_bytes) },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">App details</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <Row key={r.label} {...r} />
        ))}
      </div>
    </Card>
  );
}
