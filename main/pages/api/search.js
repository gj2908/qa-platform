import { createServerSupabase } from "../../lib/supabase/server";

// Powers the Cmd/Ctrl+K command palette. RLS-respecting client — results
// are automatically scoped to projects/releases/tasks the caller can see,
// no extra permission code needed here.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const q = (req.query.q || "").trim();
  if (!q) {
    res.status(200).json({ projects: [], releases: [], tasks: [] });
    return;
  }
  const pattern = `%${q}%`;

  // Optional org scoping — when searching from within an org's pages,
  // narrow results to that org's projects only. Still RLS-scoped
  // underneath (a caller only ever sees projects they already have
  // access to), this just adds a further filter on top.
  const orgId = (req.query.orgId || "").trim();
  let orgProjectIds = null;
  if (orgId) {
    const { data: orgProjects } = await supabase.from("projects").select("id").eq("org_id", orgId);
    orgProjectIds = (orgProjects || []).map((p) => p.id);
    if (orgProjectIds.length === 0) {
      res.status(200).json({ projects: [], releases: [], tasks: [] });
      return;
    }
  }

  let projectsQuery = supabase.from("projects").select("id, name").ilike("name", pattern).limit(5);
  let releasesQuery = supabase
    .from("releases")
    .select("id, app_name, version, build_number, platform, project_id")
    .not("project_id", "is", null)
    .or(`app_name.ilike.${pattern},version.ilike.${pattern}`)
    .limit(5);
  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, project_id")
    .ilike("title", pattern)
    .not("project_id", "is", null)
    .limit(5);
  if (orgProjectIds) {
    projectsQuery = projectsQuery.in("id", orgProjectIds);
    releasesQuery = releasesQuery.in("project_id", orgProjectIds);
    tasksQuery = tasksQuery.in("project_id", orgProjectIds);
  }

  const [{ data: projects }, { data: releases }, { data: tasks }] = await Promise.all([
    projectsQuery,
    releasesQuery,
    tasksQuery,
  ]);

  res.status(200).json({
    projects: projects || [],
    releases: releases || [],
    tasks: tasks || [],
  });
}
