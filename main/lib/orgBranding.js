// Resolves a project's org branding (white-label logo/accent), if any.
// Used by the public-facing pages (share/channel/docs) so a branded org's
// testers see their own logo instead of the default QA Platform one.
// Returns null when the project has no org, or the org has no branding
// set — callers fall back to the default Logo rendering in that case.
export async function getOrgBranding(supabase, projectId) {
  if (!projectId) return null;

  const { data: project } = await supabase.from("projects").select("org_id").eq("id", projectId).maybeSingle();
  if (!project?.org_id) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url, accent_color")
    .eq("id", project.org_id)
    .maybeSingle();
  if (!org || (!org.logo_url && !org.accent_color)) return null;

  return { orgName: org.name, logoUrl: org.logo_url || null, accentColor: org.accent_color || null };
}
