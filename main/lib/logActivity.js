// Best-effort project activity logging — mirrors lib/webhookNotify.js's
// rule that a logging failure must never block the real mutation it's
// attached to. ip/userAgent are optional (only server-side call sites with
// a `req` object can pass them — client-inserted rows, like task lifecycle
// events, leave them null).
export async function logActivity(service, { projectId, actorEmail, action, detail, ip, userAgent }) {
  try {
    await service.from("project_activity").insert({
      project_id: projectId,
      actor_email: actorEmail,
      action,
      detail: detail || null,
      actor_ip: ip || null,
      actor_user_agent: userAgent || null,
    });
  } catch (e) {
    // ignored — activity logging never fails the caller's real action
  }
}
