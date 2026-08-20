import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { sendEmail, escapeHtml, renderEmail, EMAIL_STYLES } from "../../../lib/emailClient";
import { sendPushToEmails } from "../../../lib/pushSend";

// Fired best-effort from TaskDetailDialog.js right after a comment's
// project_activity mention row is logged. Re-validates server-side
// rather than trusting the client's mention list — never emails an
// address that isn't actually a collaborator on this project.
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

  const { projectId, taskId, mentionedEmail, commentExcerpt } = req.body || {};
  if (!projectId || !taskId || !mentionedEmail) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (!role) {
    res.status(403).json({ error: "Not a project member" });
    return;
  }

  const service = createServiceClient();
  const { data: collaborator } = await service
    .from("project_collaborators")
    .select("email")
    .eq("project_id", projectId)
    .eq("email", mentionedEmail)
    .maybeSingle();
  if (!collaborator) {
    // Not a real collaborator on this project — no-op, not an error
    // (avoids using this endpoint to probe arbitrary addresses).
    res.status(200).json({ ok: false });
    return;
  }

  const { data: task } = await service.from("tasks").select("title").eq("id", taskId).single();
  const { data: project } = await service.from("projects").select("name").eq("id", projectId).single();

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const boardUrl = `${protocol}://${host}/projects/${projectId}/board`;
  const taskTitle = task?.title || "a task";

  const result = await sendEmail({
    to: mentionedEmail,
    subject: `${user.email} mentioned you in "${taskTitle}"`,
    html: renderEmail({
      heading: "You were mentioned",
      bodyHtml: `<p ${EMAIL_STYLES.p}>${escapeHtml(user.email)} mentioned you in a comment on <strong>${escapeHtml(
        taskTitle
      )}</strong>${project?.name ? ` (${escapeHtml(project.name)})` : ""}:</p><blockquote ${
        EMAIL_STYLES.blockquote
      }>${escapeHtml(commentExcerpt || "")}</blockquote>`,
      ctaLabel: "Open task",
      ctaUrl: boardUrl,
    }),
  });

  try {
    await sendPushToEmails(service, [mentionedEmail], {
      title: `${user.email} mentioned you`,
      body: `In "${taskTitle}": ${commentExcerpt || ""}`,
      url: boardUrl,
    });
  } catch (e) {
    // ignored — push failures never affect the mention-email result
  }

  res.status(200).json({ ok: result.ok });
}
