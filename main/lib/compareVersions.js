// Dot-separated-numeric comparison, not full semver — no new dependency
// for this. Every release published through this platform uses plain
// numeric versions (no pre-release tags like "1.0.0-beta.1"), so this
// covers the real cases. Returns -1 if a<b, 0 if equal, 1 if a>b.
export function compareVersions(a, b) {
  const partsA = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const x = partsA[i] || 0;
    const y = partsB[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
