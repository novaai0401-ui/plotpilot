import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

// promisify's TS types only cover the 3-arg scrypt overload; the runtime
// happily accepts the 4-arg form with ScryptOptions. Cast through unknown.
const scrypt = promisify(scryptCb) as unknown as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Password hashing — scrypt (RFC 7914), the algorithm recommended by NIST
 * SP 800-63B as a Memory-Hard Function alongside argon2. Implemented via
 * Node's built-in `crypto.scrypt` — zero native dependencies, zero external
 * packages.
 *
 * Encoded format (single string column):
 *
 *   scrypt$N$r$p$saltHex$hashHex
 *
 * - N: CPU/memory cost (2^14 = 16384 by default — ~64 MB of memory)
 * - r: block size (8)
 * - p: parallelization (1)
 * - salt: 16 random bytes (hex)
 * - hash: 64-byte derived key (hex)
 *
 * The params live in the encoded string so we can rotate them per-row without
 * a schema change. verifyPassword() reads the params from the stored string.
 *
 * Timing: ~80 ms per hash on commodity hardware. Acceptable for login latency,
 * heavy enough that brute-forcing 8-char passwords is impractical.
 */

const DEFAULT_N = 1 << 14; // 16384
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
// Node enforces strict inequality: maxmem must be STRICTLY greater than 128*N*r.
// Double the floor so callers don't have to think about it.
const MAX_MEM = 256 * DEFAULT_N * DEFAULT_R;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (plain.length > 1024) {
    // Don't let attackers DoS us by submitting megabyte passwords.
    throw new Error("Password is unreasonably long.");
  }
  const salt = randomBytes(SALT_LEN);
  const derived = (await scrypt(plain, salt, KEY_LEN, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
    maxmem: MAX_MEM,
  })) as Buffer;
  return `scrypt$${DEFAULT_N}$${DEFAULT_R}$${DEFAULT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = parseInt(parts[1]!, 10);
  const r = parseInt(parts[2]!, 10);
  const p = parseInt(parts[3]!, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "hex");
    expected = Buffer.from(parts[5]!, "hex");
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;

  let derived: Buffer;
  try {
    derived = (await scrypt(plain, salt, KEY_LEN, {
      N,
      r,
      p,
      maxmem: Math.max(MAX_MEM, 256 * N * r),
    })) as Buffer;
  } catch {
    return false;
  }
  // Constant-time compare to avoid leaking match position via timing.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Returns true iff the stored hash uses the current default params.
 * Login should call this and re-hash on successful login if it returns false,
 * so we can transparently strengthen old hashes when defaults change.
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return (
    parseInt(parts[1]!, 10) !== DEFAULT_N ||
    parseInt(parts[2]!, 10) !== DEFAULT_R ||
    parseInt(parts[3]!, 10) !== DEFAULT_P
  );
}
