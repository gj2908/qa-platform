// Local-only "recently viewed projects" shortcut for the dashboard —
// same precedent as lib/theme.js's local-only preference storage.
// Doesn't sync across devices; that's an acceptable trade-off for a
// convenience shortcut, not a system of record.
const STORAGE_KEY = "qa-platform-recent-projects";
const MAX_ENTRIES = 5;

export function getRecentlyViewed() {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (e) {
    return [];
  }
}

export function addRecentlyViewed(project) {
  if (typeof window === "undefined" || !project?.id) return;
  const existing = getRecentlyViewed().filter((p) => p.id !== project.id);
  const next = [{ id: project.id, name: project.name, visitedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
