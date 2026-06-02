"use client";
/**
 * Drop-in `fetch()` wrapper that adds the CSRF header automatically on
 * mutating requests. Use this from client components instead of the raw
 * `fetch()` for any POST/PUT/PATCH/DELETE call to our own /api/* routes.
 *
 * Example:
 *   import { csrfFetch } from "@/lib/security/csrf-fetch";
 *   const res = await csrfFetch("/api/team/invite", { method: "POST", body: ... });
 */

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "X-CSRF-Token";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!needsCsrf) return fetch(input, init);

  const token = readCsrfToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set(CSRF_HEADER, token);
  return fetch(input, { ...init, headers });
}
