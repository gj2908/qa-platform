import { createClient } from "./supabase/client";

// Browser-only Web Push helpers. _app.js registers the service worker
// eagerly on app-shell pages for install support, but *subscribing* to
// push only ever happens when the user actively enables it in Settings,
// matching this app's opt-in pattern for digest/release-email toggles.

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// VAPID application server keys are base64url; the Push API needs them
// as a Uint8Array. Standard boilerplate for subscribing.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Reflects whether *this browser* already has an active push
// subscription, so the Settings toggle can show correct on/off state
// instead of always defaulting to "Enable."
export async function getPushSubscriptionState() {
  if (!isPushSupported()) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "off";
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

export async function subscribeToPush(userEmail) {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser.");

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push notifications aren't configured yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      email: userEmail,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
