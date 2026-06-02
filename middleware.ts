import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: CSRF + protected-route gate.
 *
 * Auth is now fully native — the session cookie is `pb_session` (HttpOnly,
 * SameSite=lax). Middleware only checks for the cookie's PRESENCE here; the
 * Server Component layer revalidates against the DB. This keeps middleware
 * edge-runtime-compatible (no Prisma in edge).
 */

// Middleware runs on edge runtime — node:crypto.randomBytes unavailable.
// WebCrypto is the cross-runtime path.
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SESSION_COOKIE = "pb_session";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_PREFIXES = [
  "/api/billing/webhook",
  "/api/webhooks/whatsapp",
  "/api/email/track",
  "/api/oauth/token",
  "/api/oauth/revoke",
  "/api/v1/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/admin");
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // ---- CSRF guard (double-submit cookie) ----
  const isMutating = MUTATING_METHODS.has(request.method);
  const isCsrfExempt = CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  if (isMutating && !isCsrfExempt) {
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = request.headers.get(CSRF_HEADER);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
  }

  // ---- Session presence check ----
  // Bare cookie check at edge — the actual user resolution happens in Server
  // Components via lib/auth/session.ts (which does the DB lookup + bumps
  // lastSeenAt). We just want to short-circuit obvious cases here.
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isProtected && !hasSession) {
    const u = request.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("from", pathname);
    return NextResponse.redirect(u);
  }
  if (isAuthPage && hasSession) {
    const u = request.nextUrl.clone();
    u.pathname = "/dashboard";
    return NextResponse.redirect(u);
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  ensureCsrfCookie(request, response);
  return response;
}

function ensureCsrfCookie(req: NextRequest, res: NextResponse) {
  if (req.cookies.get(CSRF_COOKIE)) return;
  res.cookies.set({
    name: CSRF_COOKIE,
    value: randomHex(32),
    path: "/",
    sameSite: "lax",
    httpOnly: false, // client wrappers need to mirror it into x-csrf-token
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js|workbox-|api/email/track/|api/billing/webhook).*)",
  ],
};
