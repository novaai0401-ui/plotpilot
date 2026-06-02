import { createHmac, randomBytes } from "crypto";

/**
 * RFC 6238 TOTP — HMAC-based One-Time Password with time step.
 * RFC 4648 base32 for the shared-secret encoding (compatible with Google
 * Authenticator, 1Password, Authy, etc.).
 *
 * Implemented from scratch over `node:crypto` — no third-party dep.
 *
 * Defaults:
 *  - period: 30 seconds
 *  - digits: 6
 *  - algorithm: SHA-1 (the RFC 6238 default; what Google Authenticator
 *    speaks. We could go SHA-256 but most authenticator apps stay SHA-1.)
 */

const PERIOD = 30;
const DIGITS = 6;
const ALG = "sha1";
const SECRET_BYTES = 20; // 160 bits — RFC 4226 recommended

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_INV: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < BASE32_ALPHABET.length; i++) m[BASE32_ALPHABET[i]!] = i;
  return m;
})();

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

/**
 * Build the standard otpauth:// URI consumed by every authenticator app.
 * Show this as a QR code at MFA enrollment.
 *
 *   otpauth://totp/{issuer}:{account}?secret=XXX&issuer={issuer}&algorithm=SHA1&digits=6&period=30
 */
export function totpAuthUri(opts: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.account)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Compute the current TOTP code for a secret. Used in tests and as the
 * subroutine of verifyTotp.
 */
export function generateTotp(secretBase32: string, now: Date = new Date()): string {
  const counter = Math.floor(now.getTime() / 1000 / PERIOD);
  return generateHotp(secretBase32, counter);
}

/**
 * Verify a user-submitted code against the secret. Accepts the current
 * 30-second window plus one window on each side to absorb clock skew
 * (90-second tolerance total). Returns true exactly once per (secret,
 * counter) pair — caller is responsible for preventing replays (e.g. by
 * caching last-accepted counter per user).
 */
export function verifyTotp(secretBase32: string, code: string, now: Date = new Date()): boolean {
  if (!code || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now.getTime() / 1000 / PERIOD);
  for (const offset of [-1, 0, 1]) {
    if (constantTimeCompare(code, generateHotp(secretBase32, counter + offset))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate single-use recovery codes shown to the user at MFA enrollment.
 * Format: 8 chunks of 10 chars, base32 alphabet. Easy to read aloud / type.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(base32Encode(randomBytes(7)).slice(0, 10));
  }
  return out;
}

// ─── internals ────────────────────────────────────────────────────────────────

function generateHotp(secretBase32: string, counter: number): string {
  const secret = base32Decode(secretBase32.replace(/=+$/, "").toUpperCase());
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const h = createHmac(ALG, secret).update(buf).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const code =
    (((h[offset]! & 0x7f) << 24) |
      ((h[offset + 1]! & 0xff) << 16) |
      ((h[offset + 2]! & 0xff) << 8) |
      (h[offset + 3]! & 0xff)) %
    10 ** DIGITS;
  return code.toString().padStart(DIGITS, "0");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base32Encode(buf: Buffer): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/, "").toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of cleaned) {
    const v = BASE32_INV[c];
    if (v == null) throw new Error(`Invalid base32 char: ${c}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
