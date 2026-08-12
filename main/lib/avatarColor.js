// Consistent per-person avatar color, hashed from email (always present,
// unlike name) so the same person is always the same color everywhere —
// top bar, team lists, task assignees. Plain Tailwind palette classes
// with explicit dark: variants, a deliberate exception to the app's
// CSS-token system: a color wheel needs more hue variety than the 5
// semantic tones (accent/success/warning/danger/neutral) provide.
const PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300" },
];

export function getAvatarColor(seed) {
  const str = seed || "";
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
