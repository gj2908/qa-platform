import Card from "../ui/Card";
import Button from "../ui/Button";
import ExpandableList from "../ui/ExpandableList";
import { activityMetaFor } from "../../lib/activityMeta";
import { relativeTime } from "../../lib/format";
import { Clock, Download } from "lucide-react";

// Merged project+org activity feed — read-only for every role. The
// "Export activity" link is admin-only but lives here (not on the
// Projects card it used to sit on) since it exports org-wide activity,
// not project data.
export default function ActivityCard({ org, isAdmin, activity }) {
  if (activity.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <h2 className="text-sm font-semibold text-ink-primary">Recent activity</h2>
        </div>
        {isAdmin && (
          <a href={`/api/organizations/${org.id}/activity-export`}>
            <Button variant="secondary" size="sm">
              <Download size={13} strokeWidth={2.25} />
              Export activity
            </Button>
          </a>
        )}
      </div>
      <ExpandableList
        items={activity}
        visibleCount={5}
        className="mt-4 flex flex-col gap-3.5"
        renderItem={(a) => {
          const meta = activityMetaFor(a.action);
          const Icon = meta.icon;
          return (
            <div key={a.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                <Icon size={12} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-primary">
                  <span className="font-medium">{a.actor_email}</span> {meta.label}
                  {a.project_name ? <span className="text-ink-tertiary"> in {a.project_name}</span> : null}
                  {a.detail ? <span className="text-ink-tertiary"> — {a.detail}</span> : null}
                </p>
                <p className="text-xs text-ink-tertiary">{relativeTime(a.created_at)}</p>
              </div>
            </div>
          );
        }}
      />
    </Card>
  );
}
