// Best-effort org-level activity logging — same "never block the real
// mutation" rule as lib/logActivity.js. Separate table (org_activity)
// rather than project_activity, since that table's project_id is
// not-null and scoped to a single project by design.
export async function logOrgActivity(service, { orgId, actorEmail, action, detail }) {
  try {
    await service.from("org_activity").insert({
      org_id: orgId,
      actor_email: actorEmail,
      action,
      detail: detail || null,
    });
  } catch (e) {
    // ignored — activity logging never fails the caller's real action
  }
}
