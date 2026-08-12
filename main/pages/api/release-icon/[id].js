import { createServiceClient } from "../../../lib/supabase/server";

// Serves the extracted app icon (stored as a base64 data URI on the
// release) as a real image response. Needed because iOS's OTA install
// manifest requires an actual https URL for display-image/full-size-image
// assets — a data: URI won't do, since the device fetches it separately.
// Intentionally unauthenticated (see middleware.js), same reasoning as
// /api/manifest: fetched directly by iOS, not from the browser.
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    res.status(400).end();
    return;
  }

  const supabase = createServiceClient();
  const { data: release } = await supabase.from("releases").select("app_icon").eq("id", id).single();

  const match = release?.app_icon?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(404).end();
    return;
  }

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.status(200).send(buffer);
}
