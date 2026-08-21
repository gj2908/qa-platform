import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { logActivity } from "../../../lib/logActivity";
import { notifyProjectWebhooks, buildCollaboratorPayload } from "../../../lib/webhookNotify";
import { sendEmail, renderEmail, escapeHtml, EMAIL_STYLES } from "../../../lib/emailClient";
import { getRequestOrigin } from "../../../lib/getRequestOrigin";

const VALID_ROLES = ["viewer", "commenter", "editor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Also used to change an existing collaborator's role — the unique
// (project_id, email) constraint makes this an upsert. Accepts either a
// single `email` (existing shape, unchanged response) or an `emails`
// array (bulk invite from collaborators.js, returns a per-email result
// list instead of a single ok/error).
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

  const { projectId, email, emails, role, sendInvite } = req.body || {};
  const isBulk = Array.isArray(emails);
  const rawList = isBulk ? emails : [email];

  if (!projectId || rawList.length === 0 || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "A project, at least one email, and a role are required." });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (callerRole !== "owner") {
    res.status(403).json({ error: "Only the project owner can add collaborators" });
    return;
  }

  const service = createServiceClient();
  const { data: project } = await service.from("projects").select("name, webhook_url, org_id").eq("id", projectId).single();

  const results = [];
  for (const raw of rawList) {
    const normalizedEmail = (raw || "").trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      results.push({ email: raw, ok: false, error: "Not a valid email address" });
      continue;
    }
    if (normalizedEmail === user.email) {
      results.push({ email: normalizedEmail, ok: false, error: "You're already the owner of this project" });
      continue;
    }

    const { error } = await authSupabase
      .from("project_collaborators")
      .upsert({ project_id: projectId, email: normalizedEmail, role }, { onConflict: "project_id,email" });

    if (error) {
      results.push({ email: normalizedEmail, ok: false, error: error.message });
      continue;
    }

    let invited = false;
    if (sendInvite) {
      try {
        // profiles rows only ever exist via handle_new_user()'s trigger
        // on auth.users insert — same "has an account" proxy used by
        // pages/api/organizations/members/add.js. Re-checked here
        // server-side rather than trusting the client's earlier
        // check-emails call, in case the account was created in between.
        const { data: existingProfile } = await service
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!existingProfile) {
          const inviterName = user.user_metadata?.full_name || user.email;
          const projectName = project?.name || "the project";
          const signupUrl = `${getRequestOrigin(req)}/login?mode=signup&email=${encodeURIComponent(normalizedEmail)}`;

          const emailResult = await sendEmail({
            to: normalizedEmail,
            subject: `${inviterName} added you to ${projectName}`,
            html: renderEmail({
              heading: `You've been added to ${projectName}`,
              bodyHtml: `<p ${EMAIL_STYLES.p}>${escapeHtml(inviterName)} added you to <strong>${escapeHtml(
                projectName
              )}</strong> on Vrsnify. Create an account using exactly this email address — <strong>${escapeHtml(
                normalizedEmail
              )}</strong> — to get started; you'll already have access once you sign in.</p>`,
              ctaLabel: "Create your account",
              ctaUrl: signupUrl,
            }),
          });
          invited = emailResult.ok;
        }
      } catch (e) {
        // ignored — never let the invite email affect the actual add
      }
    }

    results.push({ email: normalizedEmail, ok: true, invited });

    await logActivity(service, {
      projectId,
      actorEmail: user.email,
      action: "collaborator_added",
      detail: `${normalizedEmail} as ${role}`,
    });

    try {
      if (project?.webhook_url || project?.org_id) {
        await notifyProjectWebhooks(
          service,
          { id: projectId, webhook_url: project?.webhook_url, org_id: project?.org_id },
          buildCollaboratorPayload({ email: normalizedEmail, role, action: "added" }),
          "collaborator_added"
        );
      }
    } catch (e) {
      // ignored
    }
  }

  if (!isBulk) {
    const only = results[0];
    if (!only.ok) {
      res.status(400).json({ error: only.error });
      return;
    }
    res.status(200).json({ ok: true, invited: only.invited });
    return;
  }

  res.status(200).json({ results });
}
