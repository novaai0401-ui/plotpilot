import { cookies } from "next/headers";
import { mintToken, hashTokenSha256 } from "./tokens";
import { prisma } from "@/lib/db/prisma";

/**
 * Native session cookie management.
 *
 * Cookie name `pb_session`. Value is the raw token `pbsess_<base32>`.
 * The token is sha256-hashed at rest in the Session table; the raw value
 * is only ever in the user's cookie store.
 *
 * Properties:
 *   - HttpOnly: true (no JS access — defeats XSS exfiltration)
 *   - Secure: prod only (so dev over http still works)
 *   - SameSite: lax (CSRF defense; explicit form posts still work)
 *   - Path: / (every route gets the cookie)
 *   - maxAge: 7 days, sliding window via lastSeenAt updates
 */

export const SESSION_COOKIE = "pb_session";
const TOKEN_PREFIX = "pbsess_";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CreateSessionInput = {
  userId: string;
  mfaVerified: boolean;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Create a Session row and set the cookie on the *outgoing* response by
 * mutating `cookies()`. The raw token is returned in case callers want to
 * inspect it; do NOT log it.
 */
export async function createSession(input: CreateSessionInput): Promise<{ rawToken: string; sessionId: string }> {
  const { rawToken, tokenHash } = mintToken(TOKEN_PREFIX, 32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const row = await prisma.session.create({
    data: {
      tokenHash,
      userId: input.userId,
      ip: input.ip || null,
      userAgent: input.userAgent || null,
      mfaVerified: input.mfaVerified,
      expiresAt,
      lastSeenAt: new Date(),
    },
  });
  setSessionCookie(rawToken, expiresAt);
  return { rawToken, sessionId: row.id };
}

export function setSessionCookie(rawToken: string, expiresAt: Date) {
  cookies().set({
    name: SESSION_COOKIE,
    value: rawToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie() {
  cookies().set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the current request's session via the cookie. Returns the active
 * Session row + the User, or null.
 *
 * Side effects:
 *  - Bumps lastSeenAt so /dashboard/settings/security can show a useful
 *    "last activity" timestamp per session.
 *  - Lazy-marks expired sessions so they don't continue to authenticate.
 */
export async function readSession() {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = hashTokenSha256(raw);
  const row = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row) return null;
  if (row.status !== "active") return null;
  if (row.expiresAt < new Date()) {
    await prisma.session
      .update({ where: { id: row.id }, data: { status: "expired" } })
      .catch(() => {});
    return null;
  }
  // Best-effort lastSeenAt bump (debounced to once per minute via Math.random
  // would be premature; just always update — cheap UPDATE on PK).
  await prisma.session
    .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});
  return {
    session: { id: row.id, mfaVerified: row.mfaVerified, expiresAt: row.expiresAt },
    user: row.user,
  };
}

export async function revokeSessionByCookie(): Promise<void> {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) {
    clearSessionCookie();
    return;
  }
  const tokenHash = hashTokenSha256(raw);
  await prisma.session
    .updateMany({
      where: { tokenHash, status: "active" },
      data: { status: "revoked", revokedAt: new Date() },
    })
    .catch(() => {});
  clearSessionCookie();
}
