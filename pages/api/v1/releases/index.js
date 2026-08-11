import { createServiceClient } from "../../../../lib/supabase/server";
import { verifyApiToken } from "../../../../lib/verifyApiToken";

// GET /api/v1/releases — lists published releases for the token's
// project. Bearer-token authenticated, same api_tokens table as CI
// publishing. See pages/docs/api.js.
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

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const { data: releases } = await service
    .from("releases")
    .select("id, platform, version, build_number, channel, status, app_name, install_count, created_at")
    .eq("project_id", token.project_id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  res.status(200).json({ releases: releases || [] });
}
