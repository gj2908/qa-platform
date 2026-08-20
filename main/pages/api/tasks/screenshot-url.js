import { createServerSupabase, createServiceClient } from "../../../lib/supabase/server";

// Resolves a task's attached feedback screenshot to a short-lived signed
// URL. The "feedback" bucket is private (same posture as "builds"), so
// this always goes through the service-role client — but only after
// confirming, via the RLS-respecting client, that the caller can
// actually see this task (project membership already enforces that on
// the select below).
export default async function handler(req, res) {
  const supabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { taskId } = req.query;
  if (!taskId) {
    res.status(400).json({ error: "Missing taskId" });
    return;
  }

  const { data: task } = await supabase.from("tasks").select("screenshot_path").eq("id", taskId).maybeSingle();
  if (!task?.screenshot_path) {
    res.status(404).json({ error: "No screenshot on this task" });
    return;
  }

  const service = createServiceClient();
  const { data, error } = await service.storage.from("feedback").createSignedUrl(task.screenshot_path, 3600);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ url: data.signedUrl });
}
