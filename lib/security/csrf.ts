import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Double-submit-cookie CSRF protection.
 *
 * Mechanism:
 *   - On every request without a `csrf_token` cookie, middleware sets a random
 *     64-char hex token in `csrf_token` (HttpOnly=false so JS can read it).
 *   - The browser includes the same value in a custom `X-CSRF-Token` header on
 *     mutating fetch() calls (client wrapper does this automatically).
 *   - Server compares the header against the cookie; mismatch = 403.
 *
 * Why double-submit and not synchronizer-token-pattern:
 *   - No DB round-trip per request, no server state.
 *   - Works fine across multiple Next.js serverless instances.
 *   - Defends against CSRF as long as we set `SameSite=Lax` on auth cookies
 *     (Supabase does this) and don't echo the token across origins.
 */

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCsrf(cookieValue: string | undefined, headerValue: string | null): boolean {
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);
  return timingSafeEqual(a, b);
}

/**
 * Read the current CSRF token from the request cookies (server component / route).
 * Returns null if not set.
 */
export function getCsrfToken(): string | null {
  try {
    return cookies().get(CSRF_COOKIE)?.value || null;
  } catch {
    return null;
  }
}
