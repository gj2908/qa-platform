// Web Push + minimal install support for the app shell (login through
// dashboard) — see lib/publicRoutes.js's isAppShellPath for exactly
// which routes register this. No offline caching or asset precaching;
// this deliberately isn't a full offline-capable PWA.

// A no-op fetch handler is part of Chrome's install criteria — without
// one, "Add to Home Screen"/the install prompt won't show even with a
// valid manifest. It intentionally does not call event.respondWith(),
// so every request still goes straight to the network as normal.
self.addEventListener("fetch", () => {});

// Without this, an already-registered service worker keeps running its
// old code until Chrome's own update cycle gets around to swapping it
// in (can take up to a day) — so a fix to this file (e.g. the
// icon/badge/actions added below) silently doesn't apply to anyone
// already subscribed until then. skipWaiting + clients.claim make a
// new deploy of this file take over immediately on the next push/open.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Vrsnify", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Vrsnify", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
      // Android's notification system auto-generates its own action
      // chips (e.g. a "Copy link" chip from on-device text
      // classification) when a notification has none of its own —
      // declaring a real "Open" action here takes that slot instead,
      // so tapping the notification opens the app rather than
      // triggering the OS's auto-suggested action.
      actions: [{ action: "open", title: "Open" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
