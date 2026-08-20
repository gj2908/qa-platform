import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { sendEmail, renderEmail, escapeHtml, EMAIL_STYLES } from "../../../../lib/emailClient";
import { logOrgActivity } from "../../../../lib/logOrgActivity";
import { getRequestOrigin } from "../../../../lib/getRequestOrigin";

const VALID_ROLES = ["org_admin", "member"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { orgId, email, role } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!orgId || !EMAIL_RE.test(normalizedEmail) || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "An organization, a valid email, and a role are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can add members" });
    return;
  }

  const { data: existingMember } = await authSupabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", normalizedEmail)
    .maybeSingle();
  const isNewMember = !existingMember;

  // Also used to change an existing member's role — the unique
  // (org_id, email) constraint makes this an upsert, same pattern as
  // /api/collaborators/add.js.
  const { error } = await authSupabase
    .from("org_members")
    .upsert({ org_id: orgId, email: normalizedEmail, role }, { onConflict: "org_id,email" });

  if (error) {
    // Surfaces trg_guard_seat_limit's raised exception as a friendly message.
    res.status(400).json({ error: error.message });
    return;
  }

  if (isNewMember) {
    await logOrgActivity(authSupabase, {
      orgId,
      actorEmail: user.email,
      action: "org_member_added",
      detail: `${normalizedEmail} (${role})`,
    });
  }

  let invited = false;
  if (isNewMember) {
    try {
      const service = createServiceClient();
      // profiles rows only ever exist via handle_new_user()'s trigger on
      // auth.users insert — a reliable, cheap proxy for "has an account"
      // without needing the admin API.
      const { data: existingProfile } = await service
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!existingProfile) {
        const { data: org } = await service.from("organizations").select("name").eq("id", orgId).single();
        const inviterName = user.user_metadata?.full_name || user.email;
        const orgName = org?.name || "the team";
        const signupUrl = `${getRequestOrigin(req)}/login?mode=signup&email=${encodeURIComponent(normalizedEmail)}`;

        const result = await sendEmail({
          to: normalizedEmail,
          subject: `${inviterName} added you to ${orgName}`,
          html: renderEmail({
            heading: `You've been added to ${orgName}`,
            bodyHtml: `<p ${EMAIL_STYLES.p}>${escapeHtml(inviterName)} added you to <strong>${escapeHtml(
              orgName
            )}</strong>'s team on Vrsnify. Create an account with this email address to get started — you'll already have access once you sign in.</p>`,
            ctaLabel: "Create your account",
            ctaUrl: signupUrl,
          }),
        });
        invited = result.ok;
      }
    } catch (e) {
      // ignored — never let the invite email affect the actual add
    }
  }

  res.status(200).json({ ok: true, invited });
}
