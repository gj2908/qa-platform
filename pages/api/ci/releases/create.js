import formidable from "formidable";
import { createServiceClient } from "../../../../lib/supabase/server";
import { publishRelease } from "../../../../lib/publishRelease";
import { hashToken } from "../../../../lib/apiTokens";

export const config = {
  api: { bodyParser: false },
};

// Non-interactive release publishing for CI/CD pipelines:
//   curl -X POST /api/ci/releases/create \
//     -H "Authorization: Bearer qap_..." \
//     -F platform=ios -F version=1.2.0 -F bundleId=com.company.app \
//     -F file=@app.ipa
// Bearer tokens aren't Supabase sessions, so project_role()/RLS can't
// resolve them — permission is instead the fact that the token exists,
// is unrevoked, and is scoped to exactly one project (see api_tokens'
// owner-only RLS on the *management* side; this endpoint itself always
// uses the service-role client, same trust model as the interactive
// endpoint after its own explicit role check).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing Authorization: Bearer <token> header" });
    return;
  }

  const service = createServiceClient();
  const { data: token } = await service
    .from("api_tokens")
    .select("id, project_id, label, created_by")
    .eq("token_hash", hashToken(match[1]))
    .maybeSingle();

  if (!token) {
    res.status(401).json({ error: "Invalid or revoked API token" });
    return;
  }

  const { data: creator } = await service.auth.admin.getUserById(token.created_by);
  const actorEmail = creator?.user?.email;
  if (!actorEmail) {
    res.status(500).json({ error: "Could not resolve the token's owner" });
    return;
  }

  const form = formidable({ maxFileSize: 500 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    res.status(400).json({ error: "Could not parse upload: " + e.message });
    return;
  }

  const get = (f) => (Array.isArray(fields[f]) ? fields[f][0] : fields[f]);

  await service.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);

  const result = await publishRelease({
    service,
    req,
    projectId: token.project_id,
    platform: get("platform"),
    version: get("version"),
    buildNumber: get("buildNumber") || null,
    bundleId: get("bundleId") || null,
    notes: get("notes") || null,
    webUrl: get("webUrl") || null,
    appNameInput: get("appName") || null,
    replace: get("replace") === "true" || get("replace") === "1",
    files,
    createdByUserId: token.created_by,
    actorEmail,
    activityDetailSuffix: ` (via CI token${token.label ? `: ${token.label}` : ""})`,
  });

  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.status(200).json({ releaseId: result.releaseId });
}
