// Small dependency-free CSV helpers, a deliberate duplicate of
// main/lib/csv.js — admin/ never imports across apps (separate app,
// separate deploy, see repo-root CLAUDE.md).
export function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function csvRow(values) {
  return values.map(csvEscape).join(",") + "\n";
}
