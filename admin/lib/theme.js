export const THEME_STORAGE_KEY = "qa-admin-theme";
export const THEME_OPTIONS = ["light", "dark", "device"];

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

export function applyResolvedTheme(resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

// Inlined into pages/_document.js as a blocking <script> so the correct
// theme class is on <html> before first paint — avoids a flash of the
// wrong theme on load/refresh.
export const themeInitScript = `(function(){try{var KEY="${THEME_STORAGE_KEY}";var pref=localStorage.getItem(KEY);if(["light","dark","device"].indexOf(pref)===-1)pref="device";var resolved=pref==="device"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):pref;if(resolved==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=resolved;}catch(e){}})();`;
