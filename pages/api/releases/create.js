import formidable from "formidable";
import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";
import { publishRelease } from "../../../lib/publishRelease";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // Confirm the caller is logged in (reads cookies, doesn't touch the body).
  const authSupabase = createServerSupabase(req, res);
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const form = formidable({ maxFileSize: 500 * 1024 * 1024 }); // 500MB ceiling
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    res.status(400).json({ error: "Could not parse upload: " + e.message });
    return;
  }

  const get = (f) => (Array.isArray(fields[f]) ? fields[f][0] : fields[f]);
  const projectId = get("projectId");
  const platform = get("platform");
  const version = get("version");
  const buildNumber = get("buildNumber") || null;
  const bundleId = get("bundleId") || null;
  const notes = get("notes") || null;
  const webUrl = get("webUrl") || null;
  const appNameInput = get("appName") || null;
  const replace = get("replace") === "true" || get("replace") === "1";
  const providedFilePath = get("filePath");

  if (!projectId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Publishing a release uses the service role below (it needs to touch
  // storage and run file analysis), which bypasses RLS — so the caller's
  // role has to be checked explicitly here instead of relying on the DB.
  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner" && role !== "editor") {
    res.status(403).json({ error: "You don't have permission to publish releases in this project" });
    return;
  }

  const service = createServiceClient();
  const result = await publishRelease({
    service,
    req,
    projectId,
    platform,
    version,
    buildNumber,
    bundleId,
    notes,
    webUrl,
    appNameInput,
    replace,
    files,
    providedFilePath,
    createdByUserId: user.id,
    actorEmail: user.email,
  });

  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.status(200).json({ releaseId: result.releaseId });
}
