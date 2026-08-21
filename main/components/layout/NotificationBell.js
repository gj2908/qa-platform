import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { activityMetaFor } from "../../lib/activityMeta";
import { relativeTime } from "../../lib/format";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [], unreadCount: 0 }))
      .then((data) => {
        setItems(data.items || []);
        setUnreadCount(data.unreadCount || 0);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      fetch("/api/notifications", { method: "POST" }).catch(() => {});
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
    if (ids.length === 0) return;
    fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityIds: ids }),
    }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-danger-fg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface-raised p-1.5 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Recent activity</p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-ink-tertiary hover:text-ink-secondary"
              >
                Clear all
              </button>
            )}
          </div>
          {!loaded ? (
            <p className="px-2 py-4 text-center text-sm text-ink-tertiary">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-ink-tertiary">Nothing yet.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto thin-scrollbar">
              {items.map((a) => {
                const meta = activityMetaFor(a.action);
                const Icon = meta.icon;
                const displayName = a.actorName || a.actorEmail;
                return (
                  <div key={a.id} className="group relative">
                    <Link
                      href={`/projects/${a.projectId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 rounded-md py-2 pl-2 pr-7 transition-colors hover:bg-hover"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                        <Icon size={12} strokeWidth={2.25} />
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
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-tertiary opacity-0 transition-opacity hover:bg-hover hover:text-ink-primary group-hover:opacity-100"
                    >
                      <X size={12} strokeWidth={2.25} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
