import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
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
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
            Recent activity
          </p>
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
                  <Link
                    key={a.id}
                    href={`/projects/${a.projectId}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-hover"
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
