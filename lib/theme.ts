/**
 * Theme mode utilities — `light` | `dark` | `auto` (follow system).
 *
 * Persisted in a cookie (`pb_theme`) so the server can render the right tokens
 * on the first paint, avoiding a flash-of-wrong-theme. Client toggle writes
 * the cookie + reloads (or, for routes that hydrate enough that revalidation
 * is overkill, sets a `data-theme-mode` attribute on <html> and lets the next
 * navigation pick up the cookie).
 */

import { cookies } from "next/headers";

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "pb_theme";
export const DEFAULT_THEME: ThemeMode = "auto";

export function isValidTheme(s: string | undefined): s is ThemeMode {
  return s === "light" || s === "dark" || s === "auto";
}

/**
 * Read the user's preference (server-side only). Returns DEFAULT_THEME if
 * the cookie isn't set or is malformed.
 */
export function getThemeMode(): ThemeMode {
  const value = cookies().get(THEME_COOKIE)?.value;
  return isValidTheme(value) ? value : DEFAULT_THEME;
}

/**
 * Resolve `auto` to a concrete value. On the server we can't read the user's
 * media query — we default to `light` for SSR. The client then re-resolves
 * on hydration via prefers-color-scheme and updates if needed.
 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "auto") return "light";
  return mode;
}
