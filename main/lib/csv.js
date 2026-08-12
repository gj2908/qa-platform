export function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function csvRow(values) {
  return values.map(csvEscape).join(",") + "\n";
}
