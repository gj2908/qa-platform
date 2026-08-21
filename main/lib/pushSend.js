import webpush from "web-push";

// Mirrors lib/emailClient.js's shape: an optional external provider
// that degrades to a no-op when its env vars aren't configured, rather
// than throwing and breaking the caller's best-effort try/catch.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@resend.dev",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Sends a push notification to every subscribed browser for the given
// emails. `service` is a service-role Supabase client (this needs to
// read subscriptions across users, not just the caller's own row).
export async function sendPushToEmails(service, emails, { title, body, url }) {
  if (!configured || !emails || emails.length === 0) return { ok: false };

  const { data: subs } = await service.from("push_subscriptions").select("*").in("email", emails);
  if (!subs || subs.length === 0) return { ok: false };

  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (e) {
        failed++;
        // 404/410 means the subscription is gone (browser unsubscribed,
        // uninstalled, etc.) — clean it up so future sends don't retry
        // a dead endpoint forever.
        if (e.statusCode === 404 || e.statusCode === 410) {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          // Anything else (401/403 VAPID key mismatch, malformed
          // subscription, push service outage) used to be swallowed
          // silently here with zero trace — making a real send failure
          // indistinguishable from a successful one. Logging it is the
          // only way to tell "no one has push enabled" apart from
          // "push is enabled but every send is failing."
          console.error("push send failed", {
            email: sub.email,
            statusCode: e.statusCode,
            body: e.body,
          });
        }
      }
    })
  );

  return { ok: true, sent, failed, total: subs.length };
}
