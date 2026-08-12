import { createServiceClient } from "../../lib/supabase";
import { requireAdmin } from "../../lib/requireAdmin";

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

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.status(200).json({ users: [], projects: [], releases: [] });
    return;
  }

  const service = createServiceClient();
  const lowerQ = q.toLowerCase();

  // No server-side email search in the admin user-management API at
  // this scale — list and filter in memory, same as admin/pages/users.js.
  const { data: userList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (userList?.users || [])
    .filter((u) => (u.email || "").toLowerCase().includes(lowerQ))
    .slice(0, 10)
    .map((u) => ({ id: u.id, email: u.email }));

  const { data: projects } = await service
    .from("projects")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .limit(10);

  const { data: releases } = await service
    .from("releases")
    .select("id, app_name, version, project_id")
    .not("app_name", "is", null)
    .ilike("app_name", `%${q}%`)
    .limit(10);

  res.status(200).json({
    users,
    projects: projects || [],
    releases: releases || [],
  });
}
