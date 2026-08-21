import { createServiceClient } from "../../../lib/supabase/server";
import { verifyApiToken, resolveTokenProjectId } from "../../../lib/verifyApiToken";
import { bucketForDeviceId } from "../../../lib/deviceBucket";

// GET /api/v1/feature-flags?deviceId=... — lets a running app ask "which
// flags are on for me?". Bearer-token authenticated like the rest of
// /api/v1/*. Percentage rollout reuses the exact device-bucket hashing
// already used for staged release rollout (lib/deviceBucket.js) so the
// same device consistently lands on the same side of a flag. Accepts
// either a project token or an org token (requires ?projectId=, see
// resolveTokenProjectId).
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

  const deviceId = req.query.deviceId || null;
  const bucket = deviceId ? bucketForDeviceId(deviceId) : null;

  const { data: flagRows } = await service
    .from("feature_flags")
    .select("key, enabled, rollout_percent")
    .eq("project_id", projectId);

  const flags = {};
  for (const f of flagRows || []) {
    if (!f.enabled) {
      flags[f.key] = false;
    } else if (bucket === null) {
      // No deviceId supplied — can't bucket, so only fully-off/fully-on
      // flags resolve deterministically; partial rollouts default off.
      flags[f.key] = f.rollout_percent >= 100;
    } else {
      flags[f.key] = bucket < f.rollout_percent;
    }
  }

  res.status(200).json({ flags });
}
