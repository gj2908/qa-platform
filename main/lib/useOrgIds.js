import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

// Shared by RequireMfaGate and OrgAnnouncementBanner, which both used to
// run their own identical org_members lookup on every AppShell/ProjectShell
// page mount. Both gates mount together, so a module-level in-flight-request
// cache (keyed by email, cleared once the request settles) lets the second
// caller reuse the first's request instead of firing a duplicate query —
// one round trip per page load instead of two, with no risk of the org list
// going stale across navigations (the cache entry doesn't outlive the fetch).
const inFlight = new Map();

function fetchOrgIds(email) {
  if (inFlight.has(email)) return inFlight.get(email);
  const supabase = createClient();
  const promise = supabase
    .from("org_members")
    .select("org_id")
    .eq("email", email)
    .then(({ data }) => [...new Set((data || []).map((m) => m.org_id))])
    .finally(() => inFlight.delete(email));
  inFlight.set(email, promise);
  return promise;
}

// Returns null while loading, [] once resolved with no memberships.
export function useOrgIds(email) {
  const [orgIds, setOrgIds] = useState(null);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetchOrgIds(email).then((ids) => {
      if (!cancelled) setOrgIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  return orgIds;
}
