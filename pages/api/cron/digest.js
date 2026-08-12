import { createServiceClient } from "../../../lib/supabase/server";
import { buildDigest } from "../../../lib/buildDigest";
import { sendEmail } from "../../../lib/emailClient";

// Batch daily-digest sender, triggered by vercel.json's cron schedule.
// Gated by CRON_SECRET so it can't be triggered by outsiders hitting a
// public URL — Vercel Cron sends this as a bearer token automatically
// when CRON_SECRET is set on the project.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const service = createServiceClient();
  const { data: projects } = await service.from("projects").select("id, name").eq("digest_enabled", true);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of projects || []) {
    const { data: owners } = await service
      .from("project_collaborators")
      .select("email")
      .eq("project_id", project.id);
    const recipients = [...new Set((owners || []).map((o) => o.email))];
    if (recipients.length === 0) continue;

    const digest = await buildDigest(service, project);
    if (!digest.hasContent) {
      skipped++;
      continue;
    }

    const result = await sendEmail({ to: recipients, subject: digest.subject, html: digest.html });
    if (result.ok) sent++;
    else failed++;
  }

  res.status(200).json({ ok: true, sent, skipped, failed });
}
