import { hashToken } from "./apiTokens";

// Shared by every Bearer-token-authenticated endpoint (CI publish, the
// public read API) — looks up the token, confirms it's unrevoked, and
// bumps last_used_at.
//
// Tries the project-scoped api_tokens table first (unchanged fast path,
// the only kind that existed before org-level tokens), then falls back
// to org_api_tokens. Returns a discriminated shape so callers can tell
// which kind they got: { kind: 'project', project_id, ... } or
// { kind: 'org', org_id, ... } (org tokens are always scope 'read',
// enforced at the DB level — see org_api_tokens' check constraint).
// Returns null if neither table has a match.
export async function verifyApiToken(service, req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const hash = hashToken(match[1]);

  const { data: projectToken } = await service
    .from("api_tokens")
    .select("id, project_id, label, created_by, scope")
    .eq("token_hash", hash)
    .maybeSingle();

  if (projectToken) {
    await service.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", projectToken.id);
    return { kind: "project", ...projectToken };
  }

  const { data: orgToken } = await service
    .from("org_api_tokens")
    .select("id, org_id, label, created_by, scope")
    .eq("token_hash", hash)
    .maybeSingle();

  if (orgToken) {
    await service.from("org_api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", orgToken.id);
    return { kind: "org", ...orgToken };
  }

  return null;
}

// Resolves the project id a /api/v1/*.js handler should query against,
// for either token kind. A project token always resolves to its own
// project_id (ignores any projectId query param, matching pre-org-token
// behavior exactly). An org token has no inherent project — it requires
// an explicit ?projectId= query param, and that project must actually
// belong to the token's org, or this returns an error rather than ever
// falling through to an unscoped/wrong-tenant query. This is the one
// chokepoint every org-scoping v1 endpoint must go through — duplicating
// this check per-endpoint is how a cross-tenant leak slips in.
export async function resolveTokenProjectId(service, token, req) {
  if (token.kind === "project") {
    return { projectId: token.project_id };
  }

  const projectId = req.query.projectId;
  if (!projectId) {
    return { error: { status: 400, body: { error: "projectId is required when using an organization-scoped token" } } };
  }

  const { data: project } = await service.from("projects").select("id, org_id").eq("id", projectId).maybeSingle();
  // Same 404 whether the project doesn't exist or belongs to a different
  // org — never distinguish the two, or a token holder could probe which
  // project ids exist outside their own org.
  if (!project || project.org_id !== token.org_id) {
    return { error: { status: 404, body: { error: "Project not found" } } };
  }

  return { projectId };
}
