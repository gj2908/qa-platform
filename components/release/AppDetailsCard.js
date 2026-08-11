import Card from "../ui/Card";
import { formatBytes } from "../../lib/format";

function formatUploaded(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-ink-tertiary">{label}</span>
      <span className="truncate font-medium text-ink-primary">{value}</span>
    </div>
  );
}

function DetailSection({ title, rows }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {visible.map((r) => (
          <Row key={r.label} {...r} />
        ))}
      </div>
    </Card>
  );
}

export default function AppDetailsCard({ release }) {
  const info = release.provisioning_info;

  return (
    <>
      <DetailSection
        title="App details"
        rows={[
          {
            label: release.platform === "android" ? "Package" : "Bundle identifier",
            value: release.bundle_id,
          },
          {
            label: "Version",
            value: release.build_number ? `${release.version} (${release.build_number})` : release.version,
          },
          { label: "Minimum OS", value: release.min_os_version },
          { label: "Device family", value: release.device_family },
          { label: "Size", value: formatBytes(release.file_size_bytes) },
          { label: "Installs", value: String(release.install_count ?? 0) },
          { label: "Uploaded", value: formatUploaded(release.created_at) },
          { label: "Release ID", value: <span className="font-mono text-xs">{release.id.slice(0, 8)}</span> },
        ]}
      />

      {release.platform === "ios" && info?.type && (
        <DetailSection
          title="Provisioning profile"
          rows={[
            { label: "Profile name", value: info.name },
            { label: "Profile type", value: info.type },
            {
              label: "Profile expiration",
              value: info.expirationDate ? formatUploaded(info.expirationDate) : null,
            },
            {
              label: "Provisioned devices",
              value: info.type === "Enterprise" ? "Any device" : info.deviceCount ?? null,
            },
          ]}
        />
      )}
    </>
  );
}
