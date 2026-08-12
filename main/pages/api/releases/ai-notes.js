import { createServerSupabase } from "../../../lib/supabase/server";
import { cleanUpReleaseNotes } from "../../../lib/aiClient";

// Owner/editor only. Best-effort — the caller's Textarea just keeps
// whatever was typed if this fails or ANTHROPIC_API_KEY isn't set.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { notes, projectId } = req.body || {};
  if (!notes?.trim() || !projectId) {
    res.status(400).json({ error: "Missing notes or projectId" });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: projectId });
  if (role !== "owner" && role !== "editor") {
    res.status(403).json({ error: "You don't have permission to do this" });
    return;
  }

  const result = await cleanUpReleaseNotes(notes.trim());
  if (!result.ok) {
    res.status(502).json({ error: result.error });
    return;
  }

  res.status(200).json({ notes: result.text.trim() });
}
