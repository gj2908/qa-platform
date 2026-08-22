import { useEffect } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { activityMetaFor } from "../lib/activityMeta";
import { relativeTime } from "../lib/format";
import { useNotifications } from "../lib/hooks/useNotifications";

// Full paginated notification center — the bell dropdown's "View all
// notifications" link lands here. Shares its data layer with
// NotificationBell.js via useNotifications(); this page additionally
// marks everything read once loaded (the bell only does so on open).
export default function Notifications() {
  const { items, unreadCount, loaded, loadingMore, hasMore, error, loadMore, dismiss, clearAll, markRead } =
    useNotifications();

  useEffect(() => {
    if (loaded && unreadCount > 0) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Notifications</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              Recent activity across every project you belong to.
            </p>
          </div>
          {items.length > 0 && (
            <Button variant="secondary" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">{error}</p>
        )}

        {!loaded ? (
          <Card className="px-4 py-12 text-center text-sm text-ink-tertiary">Loading…</Card>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="Nothing yet" description="You're all caught up." />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {items.map((a) => {
              const meta = activityMetaFor(a.action);
              const Icon = meta.icon;
              const displayName = a.actorName || a.actorEmail;
              return (
                <div key={a.id} className="group relative">
                  <Link
                    href={`/projects/${a.projectId}`}
                    className="flex items-start gap-3 py-3 pl-4 pr-11 transition-colors hover:bg-hover"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                      <Icon size={14} strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-primary">
                        {a.isUnread && (
                          <span
                            aria-hidden="true"
                            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                          />
                        )}
                        <span className="font-medium">{displayName}</span> {meta.label}
                      </p>
                      <p className="truncate text-xs text-ink-tertiary">
                        {a.projectName} · {relativeTime(a.createdAt)}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    title="Dismiss"
                    aria-label="Dismiss"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dismiss(a.id);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-tertiary opacity-0 transition-opacity hover:bg-hover hover:text-ink-primary group-hover:opacity-100"
                  >
                    <X size={13} strokeWidth={2.25} />
                  </button>
                </div>
              );
            })}
          </Card>
        )}

        {loaded && hasMore && (
          <div className="flex justify-center pb-2">
            <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
