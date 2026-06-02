/**
 * RFC 4180-compliant CSV encoder.
 *
 * Why not pull in `csv-stringify` or similar:
 *   - This is a tiny piece of code (< 50 LOC).
 *   - It's a security-relevant path — formula injection (=cmd) needs explicit handling.
 *   - One fewer dependency.
 *
 * Quoting rules (RFC 4180 §2.5–2.6):
 *   - Always quote fields containing CR, LF, double-quote, or the field separator.
 *   - Inside quotes, escape `"` as `""`.
 *   - We additionally quote fields starting with `=`, `+`, `-`, `@`, or tab — these
 *     can trigger formula evaluation in Excel/LibreOffice when the CSV is opened
 *     directly. Prefixing with a single quote (`'`) is the OWASP-recommended fix.
 */

const MUST_QUOTE = /[",\r\n]/;
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  // Defuse formula injection by prefixing a single quote
  if (FORMULA_LEAD.test(s)) s = "'" + s;
  if (MUST_QUOTE.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

export function csvDocument(headers: string[], rows: unknown[][]): string {
  // Excel-friendly BOM so non-ASCII renders correctly when double-clicked
  const BOM = "﻿";
  return BOM + [csvRow(headers), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}
