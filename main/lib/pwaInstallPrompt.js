// `beforeinstallprompt` fires once per page load and Chrome never re-fires
// it — so it has to be caught by a listener attached the moment this
// module first loads (imported at the top of _app.js), not by a
// component-level useEffect. UserMenu mounts late (behind auth gates and
// TopNav), well after the event has typically already fired; a listener
// registered there just misses it, which is why "Install app" never
// showed up on Android. This module-level singleton captures the event
// regardless of what's mounted yet, and components subscribe to it.
let deferredPrompt = null;
let isInstalled = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    isInstalled = true;
    notify();
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function getIsInstalledEvent() {
  return isInstalled;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function triggerInstallPrompt() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}
