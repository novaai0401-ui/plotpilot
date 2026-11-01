import type { Locale } from "./dict";

/**
 * Dates and numbers for display. Always India time, and always the same output
 * on server and browser. Latin digits are forced because Marathi would otherwise
 * default to Devanagari numerals, which brokers don't use for prices or phones.
 */
const TIME_ZONE = "Asia/Kolkata";
const tag = (locale: Locale) => `${locale}-IN-u-nu-latn`;

export function formatDate(d: Date | string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone: TIME_ZONE }).format(new Date(d));
}

export function formatDateTime(d: Date | string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(d));
}

/** Indian digit grouping, as in 12,34,567. */
export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(tag(locale)).format(n);
}

export function formatInr(n: number, locale: Locale): string {
  return `₹${formatNumber(n, locale)}`;
}
