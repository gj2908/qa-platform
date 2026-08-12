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

  const [{ data: projects }, { data: releases }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("id, name").ilike("name", pattern).limit(5),
    supabase
      .from("releases")
      .select("id, app_name, version, build_number, platform, project_id")
      .not("project_id", "is", null)
      .or(`app_name.ilike.${pattern},version.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, project_id")
      .ilike("title", pattern)
      .not("project_id", "is", null)
      .limit(5),
  ]);

  res.status(200).json({
    projects: projects || [],
    releases: releases || [],
    tasks: tasks || [],
  });
}
