import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale, translate } from "./dict";

/**
 * Server-side locale resolution. Reads `plotbroker_locale` cookie, falls back
 * to the default. Used by Server Components and route handlers.
 */
export function getLocale(): Locale {
  try {
    const raw = cookies().get("plotbroker_locale")?.value;
    if (raw && (LOCALES as readonly string[]).includes(raw)) return raw as Locale;
  } catch {
    // Outside a request scope (e.g. during build prerender) — fall through.
  }
  return DEFAULT_LOCALE;
}

/** Convenience wrapper bound to the current request's locale. */
export function t(key: string): string {
  return translate(key, getLocale());
}
