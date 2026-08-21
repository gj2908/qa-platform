import { normalizeDomain } from "./normalizeDomain";

// Resolves a project's org branding (white-label logo/accent), if any.
// Used by the public-facing pages (share/channel/docs) so a branded org's
// testers see their own logo instead of the default Vrsnify one.
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

// Resolves org branding by the hostname a request came in on — used by
// the login page so a visitor arriving via an org's connected custom
// domain sees that org's logo instead of the default Vrsnify one.
// Mirrors getOrgBranding's shape/null-handling; only matches orgs whose
// domain has actually finished connecting (see check-domain-connections
// cron), not ones still mid-DNS-setup.
export async function getOrgByDomain(supabase, hostname) {
  // req.headers.host carries a ":port" suffix in local dev (e.g.
  // "localhost:3000"); stored org domains never do, so strip it before
  // normalizing/matching.
  const domain = normalizeDomain(hostname?.split(":")[0]);
  if (!domain) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url, accent_color")
    .eq("domain", domain)
    .eq("domain_status", "connected")
    .maybeSingle();
  if (!org || (!org.logo_url && !org.accent_color)) return null;

  return { orgName: org.name, logoUrl: org.logo_url || null, accentColor: org.accent_color || null };
}
