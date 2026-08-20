// The brand mark: a checkmark (QA/verified) on the accent-blue rounded
// square — same glyph used for the PWA icons (public/icons/*) and
// notification icon (public/sw.js), kept as inline SVG here so it never
// depends on the icon files loading and can inherit currentColor.
function CheckmarkMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12.5 L10.2 17.7 L19.5 6.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// logoUrl/orgName are optional — every existing call site (no org, or an
// ungrouped project) renders exactly as before via the default params.
export default function Logo({ compact = false, logoUrl = null, orgName = null }) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={orgName || "Logo"} className="h-full w-full object-contain" />
        </span>
        {!compact && orgName && (
          <span className="truncate text-sm font-semibold tracking-tight text-ink-primary">{orgName}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
        <CheckmarkMark />
      </span>
      {!compact && (
        <span className="truncate text-sm font-semibold tracking-tight text-ink-primary">
          Vrsnify
        </span>
      )}
    </div>
  );
}
