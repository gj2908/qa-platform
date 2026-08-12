// Best-effort, dependency-free User-Agent parsing — just enough for a
// device/OS breakdown chart, not a general-purpose UA library. Only
// meaningful when called with a real browser UA (share/[id].js's page
// load) — the OS-level installer processes that hit manifest.js/
// download.js have much less useful UA strings, which is why device/OS
// capture lives on the page-view event instead.
export function parseUserAgent(ua) {
  if (!ua) return { osName: null, osVersion: null, deviceModel: null };

  let osName = null;
  let osVersion = null;
  let deviceModel = null;

  const iosMatch = ua.match(/(iPhone|iPad|iPod).*?OS (\d+[_\d]*)/);
  if (iosMatch) {
    osName = "iOS";
    osVersion = iosMatch[2].replace(/_/g, ".");
    deviceModel = iosMatch[1];
  } else {
    const androidMatch = ua.match(/Android (\d+[.\d]*)(?:;\s*([^;)]+))?/);
    if (androidMatch) {
      osName = "Android";
      osVersion = androidMatch[1];
      deviceModel = androidMatch[2] ? androidMatch[2].trim() : null;
    } else if (/Macintosh/.test(ua)) {
      osName = "macOS";
      const macMatch = ua.match(/Mac OS X (\d+[_\d]*)/);
      osVersion = macMatch ? macMatch[1].replace(/_/g, ".") : null;
    } else if (/Windows/.test(ua)) {
      osName = "Windows";
      const winMatch = ua.match(/Windows NT (\d+[.\d]*)/);
      osVersion = winMatch ? winMatch[1] : null;
    }
  }

  return { osName, osVersion, deviceModel };
}
