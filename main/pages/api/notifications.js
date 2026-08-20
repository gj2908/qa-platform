import { createServerSupabase } from "../../lib/supabase/server";

// Powers the top-bar notification bell — recent activity across every
// project the caller belongs to. RLS-respecting client: "members read
// activity" already scopes project_activity to projects the caller is on,
// and reading their own project_collaborators rows is always allowed.
export default async function handler(req, res) {
  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  if (req.method === "POST") {
    const { error } = await supabase
      .from("notification_read_state")
      .upsert({ email: user.email, last_read_at: new Date().toISOString() }, { onConflict: "email" });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    // Body { activityId } dismisses one; { all: true } dismisses every
    // activity id currently visible to this user (the "Clear all"
    // button — computed from the same query GET uses, not a blanket
    // future-proof clear, so it can't accidentally hide something not
    // yet fetched).
    const { activityId, all, activityIds } = req.body || {};
    let ids = [];
    if (activityId) ids = [activityId];
    else if (Array.isArray(activityIds)) ids = activityIds;
    else if (all) {
      res.status(400).json({ error: "Pass activityIds with the full list to clear, computed client-side from the last GET." });
      return;
    }
    if (ids.length === 0) {
      res.status(400).json({ error: "Missing activityId or activityIds" });
      return;
    }
    const { error } = await supabase
      .from("notification_dismissals")
      .upsert(
        ids.map((id) => ({ email: user.email, activity_id: id })),
        { onConflict: "email,activity_id" }
      );
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const { data: readState } = await supabase
    .from("notification_read_state")
    .select("last_read_at")
    .eq("email", user.email)
    .maybeSingle();
  const lastReadAt = readState?.last_read_at || null;

  const { data: myProjects } = await supabase
    .from("project_collaborators")
    .select("project_id")
    .eq("email", user.email);
  const allProjectIds = [...new Set((myProjects || []).map((p) => p.project_id))];

  const { data: mutedPrefs } = await supabase
    .from("notification_preferences")
    .select("project_id")
    .eq("user_id", user.id)
    .eq("muted", true);
  const mutedProjectIds = new Set((mutedPrefs || []).map((p) => p.project_id));
  const projectIds = allProjectIds.filter((id) => !mutedProjectIds.has(id));

  if (projectIds.length === 0) {
    res.status(200).json({ items: [], unreadCount: 0 });
    return;
  }

  const { data: activity } = await supabase
    .from("project_activity")
    .select("id, project_id, actor_email, action, detail, created_at, projects(name)")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: dismissals } = await supabase
    .from("notification_dismissals")
    .select("activity_id")
    .eq("email", user.email);
  const dismissedIds = new Set((dismissals || []).map((d) => d.activity_id));

  const items = (activity || []).filter((a) => !dismissedIds.has(a.id));

  const emails = [...new Set(items.map((a) => a.actor_email))];
  let nameByEmail = {};
  if (emails.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("email, full_name").in("email", emails);
    nameByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p.full_name]));
  }

  const enriched = items.map((a) => ({
    id: a.id,
    projectId: a.project_id,
    projectName: a.projects?.name || "Project",
    actorEmail: a.actor_email,
    actorName: nameByEmail[a.actor_email] || null,
    action: a.action,
    detail: a.detail,
    createdAt: a.created_at,
  }));

  const unreadCount = lastReadAt
    ? enriched.filter((a) => new Date(a.createdAt) > new Date(lastReadAt)).length
    : enriched.length;

  res.status(200).json({ items: enriched, unreadCount });
}
