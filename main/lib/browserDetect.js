// Runs client-side only — UA sniffing needs the real navigator object,
// and iPad "Request Desktop Website" mode can only be detected in-browser
// (it reports a Mac user agent but exposes touch points).
export function detectEnv() {
  if (typeof navigator === "undefined") {
    return { isIOS: false, isSafari: false, isNonSafariIOSBrowser: false, isDesktopModeIPad: false, isAndroid: false };
  }

  const ua = navigator.userAgent;

  // Real iPhone/iPad, OR an iPad that's requesting the desktop site (which
  // makes it report itself as "MacIntel" but still has touch support).
  const isDesktopModeIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isDesktopModeIPad;

  const isChromeIOS = /CriOS/i.test(ua);
  const isFirefoxIOS = /FxiOS/i.test(ua);
  const isEdgeIOS = /EdgiOS/i.test(ua);
  const isOtherIOSBrowser = isChromeIOS || isFirefoxIOS || isEdgeIOS;

  // True Safari on iOS: has "Safari" in UA, isn't one of the above, and isn't
  // a generic in-app webview (those usually lack "Safari" in the UA at all).
  const isSafari = isIOS && !isOtherIOSBrowser && /Safari/i.test(ua);
  const isNonSafariIOSBrowser = isIOS && !isSafari;

  const isAndroid = /Android/i.test(ua);

  return { isIOS, isSafari, isNonSafariIOSBrowser, isDesktopModeIPad, isAndroid };
}

// Forces the current URL to open in Safari, even from inside Chrome,
// Firefox, or an in-app webview on iOS. Apple supports this scheme
// specifically to let other apps hand a URL off to Safari.
export function safariRedirectUrl() {
  if (typeof window === "undefined") return "#";
  const { protocol, host, pathname, search } = window.location;
  return `x-safari-${protocol.replace(":", "")}://${host}${pathname}${search}`;
}
