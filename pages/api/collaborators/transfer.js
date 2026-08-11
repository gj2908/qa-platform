import { createServerSupabase } from "../../../lib/supabase/server";

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

  const { projectId, newOwnerEmail } = req.body || {};
  if (!projectId || !newOwnerEmail) {
    res.status(400).json({ error: "Missing projectId or newOwnerEmail" });
    return;
  }

  const { error } = await authSupabase.rpc("transfer_project_ownership", {
    p_project_id: projectId,
    p_new_owner_email: newOwnerEmail.trim().toLowerCase(),
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
