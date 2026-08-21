import { createServerSupabase, createServiceClient } from "../../../../lib/supabase/server";
import { logOrgActivity } from "../../../../lib/logOrgActivity";
import { logActivity } from "../../../../lib/logActivity";
import { notifyProjectWebhooks, buildCollaboratorPayload } from "../../../../lib/webhookNotify";

// Distinct from members/remove.js: that endpoint only strips org-wide
// membership (org_members). This also walks every project in the org and
// revokes the offboarded person's direct project_collaborators access, so
// "offboard" actually removes them everywhere rather than just at the org
// layer — an owner-role collaborator row is left alone (skipped, not
// force-transferred) since deleting an owner row would leave a project
// ownerless.
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

  const { orgId, email } = req.body || {};
  if (!orgId || !email) {
    res.status(400).json({ error: "Missing orgId or email" });
    return;
  }

  const { data: callerRole } = await authSupabase.rpc("org_role", { p_org_id: orgId });
  if (callerRole !== "org_admin") {
    res.status(403).json({ error: "Only an org admin can offboard members" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Same delete as members/remove.js — reused as-is, including the
  // trg_guard_last_org_admin exception surfaced the same way.
  const { error } = await authSupabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("email", normalizedEmail);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const service = createServiceClient();

  const { data: projects } = await service.from("projects").select("id").eq("org_id", orgId);
  const projectIds = (projects || []).map((p) => p.id);

  const removedFromProjects = [];
  const skippedOwnerOf = [];

  for (const projectId of projectIds) {
    try {
      const { data: collaborator } = await service
        .from("project_collaborators")
        .select("role")
        .eq("project_id", projectId)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!collaborator) continue;
      if (collaborator.role === "owner") {
        skippedOwnerOf.push(projectId);
        continue;
      }

      const { error: collabError } = await service
        .from("project_collaborators")
        .delete()
        .eq("project_id", projectId)
        .eq("email", normalizedEmail);

      if (collabError) continue;
      removedFromProjects.push(projectId);

      // Mirrors pages/api/collaborators/remove.js's activity log + webhook
      // notification exactly, reusing the same helpers rather than
      // reimplementing them.
      await logActivity(service, {
        projectId,
        actorEmail: user.email,
        action: "collaborator_removed",
        detail: normalizedEmail,
      });

      try {
        const { data: project } = await service
          .from("projects")
          .select("webhook_url, org_id")
          .eq("id", projectId)
          .single();
        if (project?.webhook_url || project?.org_id) {
          await notifyProjectWebhooks(
            service,
            { id: projectId, webhook_url: project.webhook_url, org_id: project.org_id },
            buildCollaboratorPayload({ email: normalizedEmail, role: null, action: "removed" }),
            "collaborator_removed"
          );
        }
      } catch (e) {
        // ignored
      }
    } catch (e) {
      // best-effort per project — one failure doesn't stop the rest
    }
  }

  await logOrgActivity(authSupabase, {
    orgId,
    actorEmail: user.email,
    action: "org_member_offboarded",
    detail: `${normalizedEmail} — removed from ${removedFromProjects.length} project(s), skipped ${skippedOwnerOf.length} owned project(s)`,
  });

  res.status(200).json({ ok: true, removedFromProjects, skippedOwnerOf });
}
