// Best-effort favicon + page title lookup for web releases, so the install
// page can show something more identifiable than the bare project name.
// Never throws — a site that blocks bots or has no icon just falls back to
// whatever the uploader typed in the release form.
const MAX_ICON_CHARS = 200_000;
const FETCH_TIMEOUT_MS = 5000;

async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = m ? m[1].trim() : "";
  return title ? title.slice(0, 120) : null;
}

// Picks the first <link rel="...icon..."> href, preferring apple-touch-icon
// (usually a larger, cleaner square image) if one is present.
function extractIconHref(html) {
  const linkRegex = /<link\s+[^>]*rel=["']?([^"'\s>]+)["']?[^>]*>/gi;
  let match;
  let best = null;
  while ((match = linkRegex.exec(html))) {
    const relAttr = match[1].toLowerCase();
    if (!relAttr.includes("icon")) continue;
    const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const isAppleTouch = relAttr.includes("apple-touch-icon");
    if (!best || isAppleTouch) {
      best = hrefMatch[1];
      if (isAppleTouch) break;
    }
  }
  return best;
}

async function fetchIconAsDataUri(url) {
  try {
    const res = await timedFetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/x-icon";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
    return dataUri.length <= MAX_ICON_CHARS ? dataUri : null;
  } catch (e) {
    return null;
  }
}

export async function fetchWebAppInfo(rawUrl) {
  const result = { appName: null, icon: null };

  let origin;
  try {
    origin = new URL(rawUrl).origin;
  } catch (e) {
    return result;
  }

  let html = null;
  try {
    const res = await timedFetch(rawUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QAPlatformBot/1.0)" },
    });
    if (res.ok) html = await res.text();
  } catch (e) {
    html = null;
  }

  if (html) {
    result.appName = extractTitle(html);
    const iconHref = extractIconHref(html);
    if (iconHref) {
      try {
        const iconUrl = new URL(iconHref, origin).toString();
        result.icon = await fetchIconAsDataUri(iconUrl);
      } catch (e) {
        result.icon = null;
      }
    }
  }

  if (!result.icon) {
    result.icon = await fetchIconAsDataUri(`${origin}/favicon.ico`);
  }

  return result;
}
