import { hashToken } from "./apiTokens";

// Shared by every Bearer-token-authenticated endpoint (CI publish, the
// public read API) — looks up the token, confirms it's unrevoked, and
// bumps last_used_at. Returns the token row (with project_id) or null.
export async function verifyApiToken(service, req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const { data: token } = await service
    .from("api_tokens")
    .select("id, project_id, label, created_by, scope")
    .eq("token_hash", hashToken(match[1]))
    .maybeSingle();

  if (!token) return null;

  await service.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);
  return token;
}
