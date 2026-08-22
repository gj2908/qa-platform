import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { sendEmail, escapeHtml, renderEmail, EMAIL_STYLES } from "../../../lib/emailClient";
import { sendPushToEmails } from "../../../lib/pushSend";

// Fired best-effort from board.js right after a task is assigned to the
// whole team. Re-validates server-side rather than trusting the client's
// collaborator list, same posture as notify-mention.js. Unlike the
// per-mentioned-person fan-out there, this batches every collaborator into
// one email send + one push call, since a team of 10-20 people would
// otherwise mean 10-20 parallel client-side fetches for a single action.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { projectId, taskId } = req.body || {};
  if (!projectId || !taskId) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (!role) {
    res.status(403).json({ error: "Not a project member" });
    return;
  }

  const service = createServiceClient();
  const { data: collaborators } = await service
    .from("project_collaborators")
    .select("email")
    .eq("project_id", projectId);
  const recipientEmails = (collaborators || [])
    .map((c) => c.email)
    .filter((email) => email !== user.email);

  if (recipientEmails.length === 0) {
    res.status(200).json({ ok: true, notified: 0 });
    return;
  }

  const { data: task } = await service.from("tasks").select("title").eq("id", taskId).single();
  const { data: project } = await service.from("projects").select("name").eq("id", projectId).single();

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const boardUrl = `${protocol}://${host}/projects/${projectId}/board`;
  const taskTitle = task?.title || "a task";

  await Promise.allSettled(
    recipientEmails.map((email) =>
      sendEmail({
        to: email,
        subject: `${user.email} assigned "${taskTitle}" to the whole team`,
        html: renderEmail({
          heading: "A task was assigned to the team",
          bodyHtml: `<p ${EMAIL_STYLES.p}>${escapeHtml(user.email)} assigned <strong>${escapeHtml(
            taskTitle
          )}</strong>${project?.name ? ` (${escapeHtml(project.name)})` : ""} to the whole team.</p>`,
          ctaLabel: "Open task",
          ctaUrl: boardUrl,
        }),
      })
    )
  );

  try {
    await sendPushToEmails(service, recipientEmails, {
      title: `${user.email} assigned a task to the team`,
      body: taskTitle,
      url: boardUrl,
    });
  } catch (e) {
    // ignored — push failures never affect the email fan-out result
  }

  res.status(200).json({ ok: true, notified: recipientEmails.length });
}
