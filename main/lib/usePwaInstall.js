import { useEffect, useState, useCallback } from "react";
import { detectEnv } from "./browserDetect";
import { getDeferredPrompt, getIsInstalledEvent, subscribe, triggerInstallPrompt } from "./pwaInstallPrompt";

// Drives the "Install app" menu item: shows it only on mobile web (never
// desktop — installability there is handled by the browser's own omnibox
// icon), and hides it once the app is actually running standalone
// (installed to the home screen) since there's nothing left to install.
// Android/Chrome fires `beforeinstallprompt` and supports a native
// prompt — captured by lib/pwaInstallPrompt.js's module-level listener,
// since this hook (mounted inside UserMenu, deep behind auth gates) would
// otherwise attach too late to catch the one-time event. iOS Safari never
// fires that event at all — Add to Home Screen is Safari-only there, so
// `needsIOSInstructions` drives a manual instructions dialog instead.
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(() =>
    typeof window === "undefined" ? null : getDeferredPrompt()
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [env, setEnv] = useState({ isIOS: false, isSafari: false, isAndroid: false });

  useEffect(() => {
    setEnv(detectEnv());
    setDeferredPrompt(getDeferredPrompt());

    const mq = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () =>
      setIsStandalone(mq.matches || window.navigator.standalone === true || getIsInstalledEvent());
    updateStandalone();
    mq.addEventListener("change", updateStandalone);

    const unsubscribe = subscribe(() => {
      setDeferredPrompt(getDeferredPrompt());
      updateStandalone();
    });

    return () => {
      mq.removeEventListener("change", updateStandalone);
      unsubscribe();
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const accepted = await triggerInstallPrompt();
    setDeferredPrompt(getDeferredPrompt());
    return accepted;
  }, []);

  const isMobile = env.isIOS || env.isAndroid;
  const canPromptInstall = !!deferredPrompt;
  const needsIOSInstructions = env.isIOS && env.isSafari && !deferredPrompt;
  const canShowInstall = isMobile && !isStandalone && (canPromptInstall || needsIOSInstructions);

  return { canShowInstall, canPromptInstall, needsIOSInstructions, isStandalone, promptInstall };
}
