// Date formatting for Excel exports -- "31.12.2026" (DD.MM.YYYY, dot-separated),
// matching the format requested for exported spreadsheets, distinct from the
// "31 Dec 2026" style used for on-screen display.
export function fmtExcelDate(d) {
  if (!d) return '';
  const parsed = new Date(d);
  if (isNaN(parsed)) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${parsed.getFullYear()}`;
}
