import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { csvRow } from "../../../lib/csv";

const BATCH_SIZE = 1000;

// Owner-only: the full activity log (not just the latest 10 shown on the
// Overview card) as a CSV download, for compliance/record-keeping.
// Streamed in batches rather than one unbounded query + full in-memory
// buffer, since a long-lived project's history can be large.
export default async function handler(req, res) {
  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { projectId } = req.query;
  if (!projectId) {
    res.status(400).json({ error: "Missing projectId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner") {
    res.status(403).json({ error: "Only the project owner can export the activity log" });
    return;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="activity-${projectId}.csv"`);
  res.write(csvRow(["Timestamp", "Actor", "Action", "Detail"]));

  let offset = 0;
  for (;;) {
    const { data: batch } = await authSupabase
      .from("project_activity")
      .select("actor_email, action, detail, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    for (const a of batch || []) {
      res.write(csvRow([a.created_at, a.actor_email, a.action, a.detail || ""]));
    }

    if (!batch || batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  res.end();

  await logActivity(createServiceClient(), {
    projectId,
    actorEmail: user.email,
    action: "activity_exported",
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });
}
