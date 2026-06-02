import { randomBytes, createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hasScope } from "./oauth-scopes";
import type { User } from "@prisma/client";

/**
 * Bearer-token resolver for the /api/v1 namespace.
 *
 * Design rules:
 *  - Tokens are random 32 bytes, base32 of the bytes, prefixed `pbt_`.
 *    Format: pbt_<48 base32 chars>. ~256 bits of entropy.
 *  - Only sha256(token) is stored. The raw token is returned ONCE
 *    at mint time and never recoverable.
 *  - last4 of the raw token is stored separately so the UI can show
 *    "ending in •••• xyz9" without knowing the secret.
 *  - timingSafeEqual is used on every verify to avoid leaking timing info.
 */

const TOKEN_PREFIX = "pbt_"; // PlotBroker Token
const TOKEN_BYTES = 32;

export type MintedToken = {
  /** Returned to caller ONCE; the only time the raw token is visible. */
  rawToken: string;
  /** sha256 of rawToken — stored in `AccessToken.tokenHash`. */
  tokenHash: string;
  /** Last 4 chars of rawToken — stored in `AccessToken.tokenLast4`. */
  tokenLast4: string;
};

export function mintRawToken(): MintedToken {
  const buf = randomBytes(TOKEN_BYTES);
  const body = base32(buf);
  const rawToken = `${TOKEN_PREFIX}${body}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const tokenLast4 = rawToken.slice(-4);
  return { rawToken, tokenHash, tokenLast4 };
}

/** sha256 of a candidate token, for compare. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type ResolvedBearer = {
  user: Pick<User, "id" | "authId" | "orgId" | "role" | "name" | "email" | "phone">;
  scopes: string[];
  /** Null when the token is a Personal Access Token rather than OAuth-issued. */
  appId: string | null;
  appName: string | null;
  tokenId: string;
};

/**
 * Parse Authorization: Bearer <token>, look up the AccessToken row, validate
 * it (active, not expired), update lastUsedAt, return the resolved principal.
 *
 * Returns null for any non-fatal failure (missing header, malformed, no row,
 * revoked, expired). Endpoints translate null → 401.
 */
export async function resolveBearer(req: NextRequest | Request): Promise<ResolvedBearer | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  const raw = m[1]!.trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(raw);
  const row = await prisma.accessToken.findUnique({
    where: { tokenHash },
    include: { user: true, app: true },
  });
  if (!row) return null;
  if (row.status !== "active") return null;
  if (row.expiresAt && row.expiresAt < new Date()) {
    // Lazy-mark expired so the listing UI reflects state correctly.
    await prisma.accessToken
      .update({ where: { id: row.id }, data: { status: "expired" } })
      .catch(() => {});
    return null;
  }

  // Best-effort lastUsedAt bump. Don't block the request on Prisma failure.
  await prisma.accessToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    user: {
      id: row.user.id,
      authId: row.user.authId,
      orgId: row.user.orgId,
      role: row.user.role,
      name: row.user.name,
      email: row.user.email,
      phone: row.user.phone,
    },
    scopes: row.scopes,
    appId: row.appId,
    appName: row.app?.name ?? null,
    tokenId: row.id,
  };
}

/**
 * Guard helper. Returns the resolved principal or a NextResponse 401/403 to
 * surface to the client.
 */
export async function requireScope(
  req: NextRequest | Request,
  scope: string
): Promise<
  | { ok: true; principal: ResolvedBearer }
  | { ok: false; status: 401 | 403; body: { error: string; required?: string } }
> {
  const principal = await resolveBearer(req);
  if (!principal) {
    return {
      ok: false,
      status: 401,
      body: { error: "Bearer token missing, invalid, or revoked." },
    };
  }
  if (!hasScope(principal.scopes, scope)) {
    return {
      ok: false,
      status: 403,
      body: { error: `Token lacks required scope: ${scope}`, required: scope },
    };
  }
  return { ok: true, principal };
}

/**
 * RFC 4648 base32 without padding. Avoids the visually-confusable chars in
 * base58 (`0/O`, `1/l/I`) so users can read tokens off the screen if they
 * have to. 32 bytes → 52 chars.
 */
function base32(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out.toLowerCase();
}

/** Generate the `pba_xxx` client identifier shown in URLs (public). */
export function mintClientId(): string {
  return `pba_${base32(randomBytes(16))}`;
}

/** Generate a client secret + its sha256 hash. Raw shown ONCE. */
export function mintClientSecret(): { raw: string; hash: string } {
  const raw = `pbs_${base32(randomBytes(32))}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/** Constant-time compare of a candidate client_secret against a stored hash. */
export function verifyClientSecret(candidate: string, storedHash: string): boolean {
  const h = createHash("sha256").update(candidate).digest("hex");
  return constantTimeEqualHex(h, storedHash);
}
