import { createServiceClient } from "../../../../lib/supabase/server";
import { verifyApiToken, resolveTokenProjectId } from "../../../../lib/verifyApiToken";

// GET /api/v1/releases/:id — detail for a single release, scoped to the
// token's project (a token for project A can never read project B's data,
// even if it guesses an id). An org token must also pass ?projectId=
// naming a project in its own org — see resolveTokenProjectId.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const service = createServiceClient();
  const token = await verifyApiToken(service, req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization: Bearer <token> header" });
    return;
  }

  const { projectId, error: scopeError } = await resolveTokenProjectId(service, token, req);
  if (scopeError) {
    res.status(scopeError.status).json(scopeError.body);
    return;
  }

  const { data: release } = await service
    .from("releases")
    .select(
      "id, platform, version, build_number, channel, status, app_name, bundle_id, notes, install_count, created_at"
    )
    .eq("id", req.query.id)
    .eq("project_id", projectId)
    .single();

  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }

  res.status(200).json({ release });
}
