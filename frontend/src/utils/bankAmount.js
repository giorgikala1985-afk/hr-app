// Parses a bank statement amount cell, handling both "1,500.00" (US) and
// "1.500,00" / "1500,00" (EU comma-decimal) formats, currency symbols/codes,
// and parenthesized negatives — e.g. "(1500.00)".
export function parseStatementAmount(raw) {
  if (raw == null || raw === '') return 0;
  let s = String(raw).trim().replace(/[₾$€lariGELUSDEUR\s]/gi, '');
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator appears last is the decimal point
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Only a comma present — treat as decimal separator if ≤2 digits follow, else thousands grouping
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg ? -n : n;
}
