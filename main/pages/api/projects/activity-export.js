import { createServerSupabase } from "../../../lib/supabase/server";

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Owner-only: the full activity log (not just the latest 10 shown on the
// Overview card) as a CSV download, for compliance/record-keeping.
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

  const { data: activity } = await authSupabase
    .from("project_activity")
    .select("actor_email, action, detail, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const rows = [
    ["Timestamp", "Actor", "Action", "Detail"],
    ...(activity || []).map((a) => [a.created_at, a.actor_email, a.action, a.detail || ""]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="activity-${projectId}.csv"`);
  res.status(200).send(csv);
}
