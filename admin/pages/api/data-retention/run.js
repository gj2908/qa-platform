import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";

// Manually triggered (no cron — see main/CLAUDE.md on Vercel Hobby's
// cron-count/frequency limits, which is exactly the kind of thing this
// sidesteps entirely). Deletes rows older than the admin-configured
// `activity_retention_days` platform_settings value from every
// project's logging-shaped tables — never blocks on any one table
// failing, since a partial cleanup is still useful.
const TABLES = ["project_activity", "crash_reports", "page_view_events", "install_events", "webhook_deliveries", "rate_limit_events"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const admin = await requireAdmin(req, res);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const service = createServiceClient();
  const { data: setting } = await service.from("platform_settings").select("value").eq("key", "activity_retention_days").maybeSingle();
  const days = parseInt(setting?.value, 10);
  if (!days || days <= 0) {
    res.status(400).json({ error: "Set a retention threshold (in days) above before running this." });
    return;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const deleted = {};

  for (const table of TABLES) {
    const { count, error } = await service.from(table).delete({ count: "exact" }).lt("created_at", cutoff);
    deleted[table] = error ? `error: ${error.message}` : count ?? 0;
  }

  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "data_retention_cleanup_run",
    targetType: "platform",
    detail: `retention=${days}d, deleted=${JSON.stringify(deleted)}`,
  });

  res.status(200).json({ ok: true, deleted });
}
