import { createServiceClient } from "../../../../lib/supabase";
import { requireAdmin } from "../../../../lib/requireAdmin";

// Backs AdminShell's nav badge. Server-side (service-role), so this is
// always correct regardless of whether the caller is admin_allowlist- or
// ADMIN_EMAILS-authorized — the realtime subscription that keeps the
// badge live afterward only works for admin_allowlist admins (see
// is_platform_admin() in schema.sql), so this initial count is the
// fallback that keeps env-var-only admins correct on page load.
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
  const { count, error } = await service
    .from("organization_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ count: count || 0 });
}
