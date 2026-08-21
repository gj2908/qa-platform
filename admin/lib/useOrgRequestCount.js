import { useEffect, useState } from "react";
import { createRealtimeClientBrowser } from "./supabase";

// Live pending-request count for AdminShell's nav badge. Initial value
// comes from /api/organizations/requests/pending-count (service-role,
// always correct); a realtime subscription then keeps it current without
// a refresh. The subscription itself only sees rows is_platform_admin()
// allows (admin_allowlist-backed admins) — an ADMIN_EMAILS-env-var-only
// admin still gets the right count on load, just not live updates after
// that, since Postgres can't see that env var. Re-fetches the exact
// count on every change event rather than incrementing/decrementing
// client-side, so it can never drift out of sync.
export function useOrgRequestCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function refetch() {
      fetch("/api/organizations/requests/pending-count")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setCount(data.count);
        })
        .catch(() => {});
    }

    refetch();

    let supabase;
    let channel;
    createRealtimeClientBrowser().then((client) => {
      if (cancelled) return;
      supabase = client;
      channel = supabase
        .channel("organization_requests_count")
        .on("postgres_changes", { event: "*", schema: "public", table: "organization_requests" }, refetch)
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
