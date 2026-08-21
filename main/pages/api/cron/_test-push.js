import { createServiceClient } from "../../../lib/supabase/server";
import { sendPushToEmails } from "../../../lib/pushSend";

// Temporary, one-off diagnostic route — NOT a scheduled cron job, just
// borrowing the /api/cron/ path so middleware.js's existing Bearer-token
// exemption applies without touching middleware.js for a throwaway file.
// Gated by CRON_SECRET exactly like the real cron routes. Broadcasts one
// test push to every currently-subscribed device to confirm the send
// path actually reaches real browsers, then reports per-send
// success/failure counts (see lib/pushSend.js's now-logged failures).
// Delete this file once the test is done.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const service = createServiceClient();
  const { data: subs } = await service.from("push_subscriptions").select("email");
  const emails = [...new Set((subs || []).map((s) => s.email))];

  const result = await sendPushToEmails(service, emails, {
    title: "Vrsnify test notification",
    body: "If you can see this, push notifications are working.",
    url: "/dashboard",
  });

  res.status(200).json({ ok: true, subscriberEmails: emails.length, ...result });
}
