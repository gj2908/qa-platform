import { Boxes } from "lucide-react";

// logoUrl/orgName are optional — every existing call site (no org, or an
// ungrouped project) renders exactly as before via the default params.
export default function Logo({ compact = false, logoUrl = null, orgName = null }) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2.5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={orgName || "Logo"}
          className="h-7 w-7 shrink-0 rounded-md object-cover"
        />
        {!compact && orgName && (
          <span className="truncate text-sm font-semibold tracking-tight text-ink-primary">{orgName}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
        <Boxes size={16} strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="truncate text-sm font-semibold tracking-tight text-ink-primary">
          QA Platform
        </span>
      )}
    </div>
  );
}
