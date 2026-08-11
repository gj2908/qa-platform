// Best-effort project activity logging — mirrors lib/webhookNotify.js's
// rule that a logging failure must never block the real mutation it's
// attached to.
export async function logActivity(service, { projectId, actorEmail, action, detail }) {
  try {
    await service.from("project_activity").insert({
      project_id: projectId,
      actor_email: actorEmail,
      action,
      detail: detail || null,
    });
  } catch (e) {
    // ignored — activity logging never fails the caller's real action
  }
}
