import { createServiceClient } from "../../../lib/supabase/server";
import { sendWebhookNotification, buildTaskOverduePayload } from "../../../lib/webhookNotify";
import { getSetting } from "../../../lib/platformSettings";

// Nudges once per task when it passes its due date without being marked
// done — gated by CRON_SECRET exactly like the other cron routes. Primary
// channel is a project_activity row (task_overdue), which rides the
// notification bell that Part 2 already wires up; a best-effort webhook
// goes out too if the project has one configured. due_reminder_sent_at
// is stamped regardless, so this never re-checks the same task twice.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const service = createServiceClient();

  const enabled = (await getSetting(service, "task_due_reminder_enabled", "true")) !== "false";
  if (!enabled) {
    res.status(200).json({ ok: true, reminded: 0, skipped: "disabled via platform_settings" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await service
    .from("tasks")
    .select("id, project_id, title, assignee_email, due_date")
    .lt("due_date", today)
    .neq("status", "done")
    .is("due_reminder_sent_at", null);

  let reminded = 0;

  for (const task of tasks || []) {
    const { data: project } = await service
      .from("projects")
      .select("name, webhook_url")
      .eq("id", task.project_id)
      .single();

    await service.from("project_activity").insert({
      project_id: task.project_id,
      actor_email: task.assignee_email || "system",
      action: "task_overdue",
      detail: `${task.title}${task.assignee_email ? ` (${task.assignee_email})` : ""}`,
    });

    if (project?.webhook_url) {
      const boardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/projects/${task.project_id}/board`;
      await sendWebhookNotification(
        project.webhook_url,
        buildTaskOverduePayload({
          appName: project.name,
          taskTitle: task.title,
          assigneeEmail: task.assignee_email,
          boardUrl,
        }),
        { service, projectId: task.project_id, event: "task_overdue" }
      );
    }

    await service.from("tasks").update({ due_reminder_sent_at: new Date().toISOString() }).eq("id", task.id);
    reminded++;
  }

  res.status(200).json({ ok: true, reminded });
}
