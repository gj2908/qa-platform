import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

// Fired via navigator.sendBeacon when a signed-in project member clicks
// Install on the distribute page. Best-effort — never blocks the actual
// install navigation, which has already started by the time this lands.
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
    res.status(200).json({ ok: false }); // beacon response is never read
    return;
  }

  const { releaseId } = req.body || {};
  if (!releaseId) {
    res.status(200).json({ ok: false });
    return;
  }

  const { data: release } = await authSupabase.from("releases").select("project_id").eq("id", releaseId).single();
  if (!release?.project_id) {
    res.status(200).json({ ok: false });
    return;
  }

  const { data: role } = await authSupabase.rpc("project_role", { p_project_id: release.project_id });
  if (!role) {
    res.status(200).json({ ok: false });
    return;
  }

  const service = createServiceClient();
  await service.from("release_installs").insert({ release_id: releaseId, email: user.email });

  res.status(200).json({ ok: true });
}
