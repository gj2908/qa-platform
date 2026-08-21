import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { activityMetaFor } from "../lib/activityMeta";
import { relativeTime } from "../lib/format";

// Full paginated notification center — the bell dropdown's "View all
// notifications" link lands here. Reuses the same GET/POST/DELETE
// endpoints as NotificationBell.js: GET's `before` param (added
// alongside this page) keyset-paginates on created_at, at a bigger
// page size than the bell's own capped default call.
export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [], unreadCount: 0, hasMore: false }))
      .then((data) => {
        setItems(data.items || []);
        setHasMore(!!data.hasMore);
        setLoaded(true);
        if (data.unreadCount > 0) {
          fetch("/api/notifications", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {
        setError("Couldn't load notifications.");
        setLoaded(true);
      });
  }, []);

  async function loadMore() {
    if (loadingMore || items.length === 0) return;
    setLoadingMore(true);
    const before = items[items.length - 1].createdAt;
    try {
      const res = await fetch(`/api/notifications?before=${encodeURIComponent(before)}`);
      const data = res.ok ? await res.json() : { items: [], hasMore: false };
      setItems((prev) => [...prev, ...(data.items || [])]);
      setHasMore(!!data.hasMore);
    } catch {
      setError("Couldn't load more notifications.");
    } finally {
      setLoadingMore(false);
    }
  }

  function dismiss(activityId) {
    setItems((prev) => prev.filter((a) => a.id !== activityId));
    fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId }),
    }).catch(() => {});
  }

  function clearAll() {
    const ids = items.map((a) => a.id);
    setItems([]);
    setHasMore(false);
    if (ids.length === 0) return;
    fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityIds: ids }),
    }).catch(() => {});
  }

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
