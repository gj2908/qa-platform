import { createServerSupabase } from "../../../lib/supabase/server";

// A personal data export (GDPR-style "download a copy of my data") —
// everything below is explicitly scoped to the caller's own email/id
// via .eq() filters, not just left to RLS, since RLS's job is "can this
// row be read at all" (e.g. any project member can read task rows) —
// broader than "is this row about me," which is what this endpoint is
// actually promising.
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

  const [
    profile,
    projectMemberships,
    orgMemberships,
    assignedTasks,
    createdTasks,
    comments,
    timeEntries,
    savedViews,
    notificationPreferences,
    apiTokens,
    recentActivity,
  ] = await Promise.all([
    supabase.from("profiles").select("email, full_name, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("project_collaborators").select("project_id, role, created_at").eq("email", user.email),
    supabase.from("org_members").select("org_id, role, created_at").eq("email", user.email),
    supabase
      .from("tasks")
      .select("id, project_id, title, status, due_date, assigned_to_team")
      .or(`assignee_email.eq.${user.email},assigned_to_team.eq.true`),
    supabase.from("tasks").select("id, project_id, title, status, created_at").eq("created_by", user.id),
    supabase.from("task_comments").select("task_id, project_id, body, created_at").eq("author_email", user.email),
    supabase.from("task_time_entries").select("task_id, project_id, minutes, note, logged_on").eq("user_email", user.email),
    supabase.from("saved_views").select("project_id, name, filters, created_at").eq("user_id", user.id),
    supabase.from("notification_preferences").select("project_id, muted, email_enabled").eq("user_id", user.id),
    supabase.from("api_tokens").select("project_id, label, scope, created_at, last_used_at").eq("created_by", user.id),
    supabase
      .from("project_activity")
      .select("project_id, action, detail, created_at")
      .eq("actor_email", user.email)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data || null,
    projectMemberships: projectMemberships.data || [],
    organizationMemberships: orgMemberships.data || [],
    tasksAssignedToMe: assignedTasks.data || [],
    tasksICreated: createdTasks.data || [],
    comments: comments.data || [],
    timeEntries: timeEntries.data || [],
    savedBoardViews: savedViews.data || [],
    notificationPreferences: notificationPreferences.data || [],
    apiTokens: (apiTokens.data || []).map((t) => ({ ...t, note: "token value itself is never stored or exportable" })),
    recentActivity: recentActivity.data || [],
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="my-data.json"');
  res.status(200).send(JSON.stringify(exportData, null, 2));
}
