import Link from "next/link";
import Card from "../ui/Card";
import PlatformBadge from "../ui/PlatformBadge";
import { relativeTime } from "../../lib/format";

export default function OtherVersionsCard({ releases, basePath }) {
  if (!releases || releases.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Other versions</h3>
      </div>
      <div className="divide-y divide-border">
        {releases.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}/${r.id}`}
            className="flex flex-col gap-1 px-4 py-2.5 text-sm transition-colors hover:bg-hover"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <PlatformBadge platform={r.platform} />
                <span className="truncate font-medium text-ink-primary">
                  v{r.version}
                  {r.build_number ? ` (${r.build_number})` : ""}
                </span>
              </div>
              <span className="shrink-0 text-xs text-ink-tertiary">{relativeTime(r.created_at)}</span>
            </div>
            {r.notes && <p className="line-clamp-1 pl-[74px] text-xs text-ink-tertiary">{r.notes}</p>}
          </Link>
        ))}
      </div>
    </Card>
  );
}
