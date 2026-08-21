import { createServiceClient } from "../../../../lib/supabase";
import { requireAdmin } from "../../../../lib/requireAdmin";

// Backs the requests page's realtime refresh — same shape as its
// getServerSideProps, just callable client-side after a postgres_changes
// event so the table updates without a full reload.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const admin = await requireAdmin(req, res);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const service = createServiceClient();
  const { data: requests } = await service
    .from("organization_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(100);

  const orgIds = [...new Set((requests || []).filter((r) => r.org_id).map((r) => r.org_id))];
  let nameByOrgId = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await service.from("organizations").select("id, name").in("id", orgIds);
    nameByOrgId = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));
  }

  res.status(200).json({
    requests: (requests || []).map((r) => ({ ...r, org_name_resolved: r.org_id ? nameByOrgId[r.org_id] || null : null })),
  });
}
