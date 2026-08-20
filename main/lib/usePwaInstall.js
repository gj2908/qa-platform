import { useCallback, useEffect, useState } from "react";
import { detectEnv } from "./browserDetect";

// Drives the "Install app" menu item: shows it only on mobile web (never
// desktop — installability there is handled by the browser's own omnibox
// icon), and hides it once the app is actually running standalone
// (installed to the home screen) since there's nothing left to install.
// Android/Chrome fires `beforeinstallprompt` and supports a native
// prompt; iOS Safari never fires that event at all — Add to Home Screen
// is Safari-only there, so `needsIOSInstructions` drives a manual
// instructions dialog instead.
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [env, setEnv] = useState({ isIOS: false, isSafari: false, isAndroid: false });

  useEffect(() => {
    setEnv(detectEnv());

    const mq = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setIsStandalone(mq.matches || window.navigator.standalone === true);
    updateStandalone();
    mq.addEventListener("change", updateStandalone);

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      mq.removeEventListener("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  const isMobile = env.isIOS || env.isAndroid;
  const canPromptInstall = !!deferredPrompt;
  const needsIOSInstructions = env.isIOS && env.isSafari && !deferredPrompt;
  const canShowInstall = isMobile && !isStandalone && (canPromptInstall || needsIOSInstructions);

  return { canShowInstall, canPromptInstall, needsIOSInstructions, promptInstall };
}
