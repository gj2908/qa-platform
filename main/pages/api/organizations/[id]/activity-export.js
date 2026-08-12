import { createServerSupabase } from "../../../../lib/supabase/server";
import { csvRow } from "../../../../lib/csv";

const BATCH_SIZE = 1000;

// org_admin-only: the activity log across every project under this
// organization, not just one project. Works with zero new RLS policies on
// project_activity — the project_role() rewrite (see the "Organizations"
// migration) already makes the existing "members read activity" policy
// (project_role(project_id) is not null) true for every project under the
// org, even for projects the org_admin has no direct project_collaborators
// row on. Streamed in batches, same reasoning as the per-project export.
export default async function handler(req, res) {
  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { id: orgId } = req.query;
  const format = req.query.format === "json" ? "json" : "csv";

  const { data: role } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (role !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can export the organization's activity log" });
    return;
  }

  const { data: projects } = await authSupabase.from("projects").select("id, name").eq("org_id", orgId);
  const projectIds = (projects || []).map((p) => p.id);
  const nameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));

  if (projectIds.length === 0) {
    if (format === "json") {
      res.status(200).json({ rows: [] });
    } else {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="org-activity-${orgId}.csv"`);
      res.status(200).send(csvRow(["Timestamp", "Project", "Actor", "Action", "Detail"]));
    }
    return;
  }

  if (format === "json") {
    const rows = [];
    let offset = 0;
    for (;;) {
      const { data: batch } = await authSupabase
        .from("project_activity")
        .select("project_id, actor_email, action, detail, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);
      for (const a of batch || []) {
        rows.push({ ...a, project_name: nameById[a.project_id] || null });
      }
      if (!batch || batch.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
    res.status(200).json({ rows });
    return;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="org-activity-${orgId}.csv"`);
  res.write(csvRow(["Timestamp", "Project", "Actor", "Action", "Detail"]));

  let offset = 0;
  for (;;) {
    const { data: batch } = await authSupabase
      .from("project_activity")
      .select("project_id, actor_email, action, detail, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    for (const a of batch || []) {
      res.write(csvRow([a.created_at, nameById[a.project_id] || "", a.actor_email, a.action, a.detail || ""]));
    }

    if (!batch || batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  res.end();
}
