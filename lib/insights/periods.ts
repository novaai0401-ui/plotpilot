/**
 * Reporting periods, in India Standard Time.
 *
 * Why IST and not UTC: brokers think in local days. A visit at 01:00 IST on
 * the 1st is a UTC timestamp on the previous month, so UTC bucketing would put
 * it in the wrong monthly report.
 *
 * All ranges are half-open: `start` inclusive, `end` exclusive.
 */

import type { Locale } from "@/lib/i18n/dict";

export type PeriodKind = "week" | "month" | "year";
export type DateRange = { start: Date; end: Date };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS: Record<Locale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: ["जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"],
  mr: ["जाने", "फेब्रु", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"],
};

function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

function istMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
}

/** The most recent fully finished week (Mon-Sun), month or calendar year. */
export function latestCompletedRange(kind: PeriodKind, now: Date): DateRange {
  const { year, month, day, weekday } = istParts(now);
  if (kind === "week") {
    const daysSinceMonday = (weekday + 6) % 7;
    const end = istMidnight(year, month, day - daysSinceMonday);
    return { start: new Date(end.getTime() - 7 * DAY_MS), end };
  }
  if (kind === "month") {
    return { start: istMidnight(year, month - 1, 1), end: istMidnight(year, month, 1) };
  }
  return { start: istMidnight(year - 1, 0, 1), end: istMidnight(year, 0, 1) };
}

/** The period immediately before `range`, used for comparisons. */
export function previousRange(kind: PeriodKind, range: DateRange): DateRange {
  const { year, month } = istParts(range.start);
  if (kind === "week") {
    return { start: new Date(range.start.getTime() - 7 * DAY_MS), end: range.start };
  }
  if (kind === "month") {
    return { start: istMidnight(year, month - 1, 1), end: range.start };
  }
  return { start: istMidnight(year - 1, 0, 1), end: range.start };
}

export function periodLabel(kind: PeriodKind, range: DateRange, locale: Locale = "en"): string {
  const months = MONTHS[locale];
  const s = istParts(range.start);
  if (kind === "year") return String(s.year);
  if (kind === "month") return `${months[s.month]} ${s.year}`;
  const e = istParts(new Date(range.end.getTime() - 1));
  return `${s.day} ${months[s.month]} – ${e.day} ${months[e.month]} ${e.year}`;
}

/** Chart bucket for a timestamp: a day for week/month reports, a month for yearly. */
export function bucketKey(kind: PeriodKind, d: Date): string {
  const { year, month, day } = istParts(d);
  const yyyyMm = `${year}-${String(month + 1).padStart(2, "0")}`;
  return kind === "year" ? yyyyMm : `${yyyyMm}-${String(day).padStart(2, "0")}`;
}

/** Every bucket in the range, in order, so quiet days still appear as zero. */
export function bucketKeys(kind: PeriodKind, range: DateRange): string[] {
  const keys: string[] = [];
  if (kind === "year") {
    const { year } = istParts(range.start);
    for (let m = 0; m < 12; m++) keys.push(bucketKey(kind, istMidnight(year, m, 1)));
    return keys;
  }
  for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY_MS) {
    keys.push(bucketKey(kind, new Date(t)));
  }
  return keys;
}

export function inRange(d: Date | null | undefined, range: DateRange): boolean {
  return !!d && d >= range.start && d < range.end;
}
