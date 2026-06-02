import { randomBytes, createHash } from "crypto";

/**
 * Random token mint + sha256 hash helpers for session / email-verify /
 * password-reset tokens.
 *
 * Returns:
 *  - rawToken: the value placed in the cookie or the magic link
 *  - tokenHash: sha256 hex stored in DB
 *  - last4: convenience for UI ("session ending in •••• AbC2")
 */

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export type MintedToken = { rawToken: string; tokenHash: string; last4: string };

export function mintToken(prefix: string, bytes = 32): MintedToken {
  const buf = randomBytes(bytes);
  const body = base32(buf);
  const rawToken = `${prefix}${body}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const last4 = rawToken.slice(-4);
  return { rawToken, tokenHash, last4 };
}

export function hashTokenSha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function base32(buf: Buffer): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
