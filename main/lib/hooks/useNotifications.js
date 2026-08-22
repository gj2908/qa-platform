import { useEffect, useState } from "react";

// Shared data layer behind the notification bell dropdown and the full
// /notifications page — both used to fetch/dismiss/clear independently
// with byte-for-byte duplicated logic. When (and whether) to mark
// notifications read differs between the two surfaces (bell: on open,
// full page: on load), so that stays a caller decision — markRead() only
// performs the action, it never decides the trigger.
export function useNotifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [], unreadCount: 0, hasMore: false }))
      .then((data) => {
        setItems(data.items || []);
        setUnreadCount(data.unreadCount || 0);
        setHasMore(!!data.hasMore);
        setLoaded(true);
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

  function markRead() {
    setUnreadCount(0);
    fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }

  return { items, unreadCount, loaded, loadingMore, hasMore, error, loadMore, dismiss, clearAll, markRead };
}
