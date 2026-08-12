// Best-effort audit log for the admin panel's own destructive actions —
// mirrors the main app's lib/logActivity.js "never block the real
// action" rule.
export async function logAdminAction(service, { adminEmail, action, targetType, targetId, detail }) {
  try {
    await service.from("admin_actions").insert({
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId || null,
      detail: detail || null,
    });
  } catch (e) {
    // ignored
  }
}
