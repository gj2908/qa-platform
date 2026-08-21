export const THEME_STORAGE_KEY = "qa-platform-theme";
export const THEME_OPTIONS = ["light", "dark", "device"];

// Matches --bg-surface (globals.css) for each theme — TopNav's actual
// background — not --accent. The OS status bar/task-switcher color
// should read as "the app's chrome," not a banner in the brand color.
export const THEME_COLOR = { light: "#ffffff", dark: "#101012" };

export function getStoredThemePreference() {
  if (typeof window === "undefined") return "device";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : "device";
}

export function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference) {
  return preference === "device" ? (systemPrefersDark() ? "dark" : "light") : preference;
}

function applyThemeColorMeta(resolved) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLOR[resolved]);
}

export function applyResolvedTheme(resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  applyThemeColorMeta(resolved);
}

// Inlined into pages/_document.js as a blocking <script> so the correct
// theme class (and status-bar color, for the installed PWA) is set
// before first paint — avoids a flash of the wrong theme, or a flash of
// the accent-blue placeholder meta tag, on load/refresh. Duplicates
// applyThemeColorMeta's create-or-update logic inline since this runs
// before any app JS (including this module) has loaded.
export const themeInitScript = `(function(){try{var KEY="${THEME_STORAGE_KEY}";var COLORS=${JSON.stringify(THEME_COLOR)};var pref=localStorage.getItem(KEY);if(["light","dark","device"].indexOf(pref)===-1)pref="device";var resolved=pref==="device"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):pref;if(resolved==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=resolved;var meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement("meta");meta.setAttribute("name","theme-color");document.head.appendChild(meta);}meta.setAttribute("content",COLORS[resolved]);}catch(e){}})();`;
