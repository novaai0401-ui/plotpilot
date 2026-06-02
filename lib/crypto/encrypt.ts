import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * App-layer envelope encryption for sensitive fields (e.g. WhatsApp access tokens).
 *
 * Format (v2): base64(version || keyId || iv || authTag || ciphertext)
 *   - version: 1 byte (currently 0x02)
 *   - keyId:   1 byte (which ENCRYPTION_KEY_v* env var was used)
 *   - iv:      12 bytes (GCM standard)
 *   - tag:     16 bytes
 *   - ct:      remainder
 *
 * Format (v1): base64(0x01 || iv || authTag || ciphertext) — legacy; decryption still supported.
 *
 * Key rotation: set ENCRYPTION_KEY_V<N> env vars (V0 = original ENCRYPTION_KEY).
 * Reads pick the key by the keyId byte in the blob. Writes use the highest-numbered
 * key present (the "active" key). Run `tsx scripts/rotate-encryption.ts` to re-encrypt
 * stored rows with the new key.
 *
 * In production, prefer Supabase Vault or a KMS — this is a pragmatic fallback.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION_V1 = 0x01;
const VERSION_V2 = 0x02;

/**
 * Map of key-id byte → derived 32-byte AES key. Populated lazily.
 * keyId 0x00 corresponds to ENCRYPTION_KEY (the original key).
 * keyId 0xNN corresponds to ENCRYPTION_KEY_V<NN-in-decimal> (e.g. 0x01 → ENCRYPTION_KEY_V1).
 */
const keyCache = new Map<number, Buffer>();

function envForKeyId(keyId: number): string | undefined {
  if (keyId === 0) return process.env.ENCRYPTION_KEY;
  return process.env[`ENCRYPTION_KEY_V${keyId}`];
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "plot-broker-static-salt", 32);
}

function getKey(keyId: number): Buffer {
  const cached = keyCache.get(keyId);
  if (cached) return cached;
  const secret = envForKeyId(keyId);
  if (!secret || secret.length < 16) {
    throw new Error(
      `Encryption key id ${keyId} unavailable. Set ${
        keyId === 0 ? "ENCRYPTION_KEY" : "ENCRYPTION_KEY_V" + keyId
      } (16+ chars). Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  const derived = deriveKey(secret);
  keyCache.set(keyId, derived);
  return derived;
}

/**
 * Find the highest-numbered ENCRYPTION_KEY_V<N> available (or fall back to V0 / the
 * unversioned ENCRYPTION_KEY). This is the key new writes use.
 */
function activeKeyId(): number {
  let best = 0;
  // Scan up to 255 — covers any sane rotation cadence.
  for (let i = 255; i > 0; i--) {
    if (process.env[`ENCRYPTION_KEY_V${i}`]) {
      best = i;
      break;
    }
  }
  // Validate it's reachable before returning
  envForKeyId(best); // throws via getKey() on actual use if invalid
  return best;
}

export function encryptString(plaintext: string): string {
  const keyId = activeKeyId();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(keyId), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([Buffer.from([VERSION_V2, keyId]), iv, tag, ct]);
  return blob.toString("base64");
}

export function decryptString(payload: string): string {
  const blob = Buffer.from(payload, "base64");
  const version = blob[0];

  if (version === VERSION_V1) {
    // Legacy: no key id, always uses key 0
    const iv = blob.subarray(1, 1 + IV_LEN);
    const tag = blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
    const ct = blob.subarray(1 + IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, getKey(0), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  }
  if (version === VERSION_V2) {
    const keyId = blob[1];
    const iv = blob.subarray(2, 2 + IV_LEN);
    const tag = blob.subarray(2 + IV_LEN, 2 + IV_LEN + TAG_LEN);
    const ct = blob.subarray(2 + IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, getKey(keyId), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  }
  throw new Error(`Unknown encryption version: ${version}`);
}

/** Encrypted values start with our version byte (0x01 or 0x02). */
export function looksEncrypted(value: string): boolean {
  try {
    const blob = Buffer.from(value, "base64");
    if (blob.length < 1 + IV_LEN + TAG_LEN) return false;
    return blob[0] === VERSION_V1 || blob[0] === VERSION_V2;
  } catch {
    return false;
  }
}

/** Inspect a ciphertext: returns the version + keyId it was written with. */
export function inspectCiphertext(value: string): { version: number; keyId: number } | null {
  try {
    const blob = Buffer.from(value, "base64");
    if (blob[0] === VERSION_V1) return { version: 1, keyId: 0 };
    if (blob[0] === VERSION_V2) return { version: 2, keyId: blob[1] };
    return null;
  } catch {
    return null;
  }
}
