import { createHmac, randomBytes } from "crypto";

/**
 * Signed, expiring team-invite tokens.
 *
 * Two backends, auto-selected:
 *
 * 1. **ML-DSA-87 (post-quantum)** via `@sigvault/sdk`. Selected when all three
 *    env vars are set: TEAM_INVITE_SIGNING_KEY, TEAM_INVITE_VERIFYING_KEY,
 *    TEAM_INVITE_ENCRYPT_KEY. Generate via `npm run gen:invite-keys`.
 *    Wire format: hex-encoded blob (~6.7 KB — heavy for URLs but works).
 *
 * 2. **HMAC-SHA256** (default fallback). Used when sigvault keys aren't set.
 *    Wire format: `<payload-b64url>.<sig-b64url>` (~300 B).
 *
 * verifyTeamInviteToken() auto-detects format: presence of `.` → HMAC,
 * pure-hex → ML-DSA. Both backends share the same `TeamInviteTokenPayload`
 * shape so downstream code doesn't care which was used.
 *
 * Replay protection: enforced at the application layer in
 * `provisionUser()` — a token can only be used if the inviter hasn't
 * already become an org member. We do NOT rely on sigvault's MutationChain
 * because (per issue #33 in the upstream repo) the in-memory counter is a
 * no-op under serverless. The `jti` field gives us per-token uniqueness
 * for future "consumed tokens" tracking if we ever add a DB table for it.
 */

export type TeamInviteTokenPayload = {
  v: 1 | 2; // v=1 → HMAC backend, v=2 → ML-DSA backend (semantically identical)
  orgId: string;
  email: string;
  name?: string;
  role: "broker_admin" | "broker_agent";
  iat: number;
  exp: number;
  jti: string;
};

export type TeamInviteVerifyResult =
  | { ok: true; payload: TeamInviteTokenPayload; backend: "hmac" | "ml-dsa" }
  | { ok: false; error: string };

// ─── Backend selection ───────────────────────────────────────────────────────

type SigvaultKeys = {
  signingKey: Uint8Array;
  verifyingKey: Uint8Array;
  encryptKey: Uint8Array;
};

let cachedKeys: SigvaultKeys | null | undefined;
let provisionInflight: Promise<SigvaultKeys | null> | null = null;

/**
 * Resolve the ML-DSA keys to use for signing/verifying team-invite tokens.
 * Resolution order:
 *
 *   1. Env vars (TEAM_INVITE_*) — for explicit operator-managed rotation or
 *      split deployments. Wins if all three are present.
 *   2. KeyMaterial table (kind="team_invite", version=1) — auto-provisioned
 *      on first cold boot. All instances read the same row, so ML-DSA is
 *      default-on without operator setup.
 *   3. null → HMAC fallback. Only if Prisma is unreachable AND env vars
 *      are unset (e.g. local dev with no DB).
 *
 * Caches the result for the lifetime of the process. The auto-provision
 * step is INSERT … ON CONFLICT DO NOTHING + re-SELECT, so concurrent
 * cold starts converge on the same row.
 */
async function loadSigvaultKeys(): Promise<SigvaultKeys | null> {
  if (cachedKeys !== undefined) return cachedKeys;
  if (provisionInflight) return provisionInflight;

  provisionInflight = (async (): Promise<SigvaultKeys | null> => {
    // Pass 1: env vars
    const envKeys = readSigvaultKeysFromEnv();
    if (envKeys) {
      cachedKeys = envKeys;
      return cachedKeys;
    }

    // Unit tests should never auto-provision against a real DB. Skip the
    // KeyMaterial path so tests with env vars cleared force the HMAC fallback.
    // Integration tests that DO want ML-DSA set the env vars explicitly.
    if (process.env.VITEST || process.env.TEAM_INVITE_FORCE_HMAC === "1") {
      cachedKeys = null;
      return cachedKeys;
    }

    // Pass 2: KeyMaterial row
    try {
      const persisted = await loadOrProvisionKeyMaterial();
      cachedKeys = persisted;
      return cachedKeys;
    } catch (err) {
      // Prisma unreachable (dev with no DB, edge runtime). HMAC fallback.
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          level: "warn",
          subsystem: "team-invite-token",
          message:
            "Could not load or provision ML-DSA keys from KeyMaterial — falling back to HMAC. " +
            "This is expected in edge-runtime contexts. See docs/post-quantum-setup.md.",
          error: (err as Error)?.message,
        })
      );
      cachedKeys = null;
      return cachedKeys;
    }
  })();

  const result = await provisionInflight;
  provisionInflight = null;
  return result;
}

function readSigvaultKeysFromEnv(): SigvaultKeys | null {
  const sk = process.env.TEAM_INVITE_SIGNING_KEY;
  const vk = process.env.TEAM_INVITE_VERIFYING_KEY;
  const ek = process.env.TEAM_INVITE_ENCRYPT_KEY;
  if (!sk || !vk || !ek) return null;
  try {
    return {
      signingKey: Uint8Array.from(Buffer.from(sk, "hex")),
      verifyingKey: Uint8Array.from(Buffer.from(vk, "hex")),
      encryptKey: Uint8Array.from(Buffer.from(ek, "hex")),
    };
  } catch {
    return null;
  }
}

/**
 * Read the team-invite KeyMaterial row, generating + persisting one if it
 * doesn't exist yet. Multi-instance safe via the (kind, version) unique
 * constraint — concurrent INSERTs collapse to one row.
 */
async function loadOrProvisionKeyMaterial(): Promise<SigvaultKeys> {
  const { prisma } = await import("@/lib/db/prisma");
  const KIND = "team_invite";
  const VERSION = 1;

  // Fast path: row exists
  const existing = await prisma.keyMaterial.findUnique({
    where: { kind_version: { kind: KIND, version: VERSION } },
  });
  if (existing) return toSigvaultKeys(existing);

  // Slow path: generate and persist. Best-effort race handling via
  // `try { create } catch P2002 { findUnique }`. Two simultaneous cold
  // boots produce one row; the loser re-reads the winner's row.
  const { generateKeypair } = await import("@sigvault/sdk");
  const kp = generateKeypair();
  try {
    const created = await prisma.keyMaterial.create({
      data: {
        kind: KIND,
        version: VERSION,
        signingKey: Buffer.from(kp.signingKey),
        verifyingKey: Buffer.from(kp.verifyingKey),
        encryptKey: Buffer.from(kp.encryptKey),
      },
    });
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: "info",
        subsystem: "team-invite-token",
        message: "Provisioned ML-DSA keypair to KeyMaterial — ML-DSA is now default-on.",
        kind: KIND,
        version: VERSION,
        keyMaterialId: created.id,
      })
    );
    return toSigvaultKeys(created);
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Lost the race — re-read the winner's row.
      const winner = await prisma.keyMaterial.findUnique({
        where: { kind_version: { kind: KIND, version: VERSION } },
      });
      if (winner) return toSigvaultKeys(winner);
    }
    throw e;
  }
}

function toSigvaultKeys(row: {
  signingKey: Buffer;
  verifyingKey: Buffer;
  encryptKey: Buffer;
}): SigvaultKeys {
  return {
    signingKey: Uint8Array.from(row.signingKey),
    verifyingKey: Uint8Array.from(row.verifyingKey),
    encryptKey: Uint8Array.from(row.encryptKey),
  };
}

/**
 * Test-only: reset the module-level cache so a test can mutate env vars
 * between cases and have `loadSigvaultKeys` re-evaluate. Not exported as a
 * public API — exposed by name only.
 */
export function __resetSigvaultKeyCache_TEST_ONLY(): void {
  cachedKeys = undefined;
  provisionInflight = null;
}

// ─── HMAC backend ────────────────────────────────────────────────────────────

function hmacSecret(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length < 16) {
    throw new Error("ENCRYPTION_KEY env var must be set (16+ chars) to sign team-invite tokens");
  }
  return Buffer.from(k);
}

function b64urlEncode(b: Buffer | string): string {
  return Buffer.from(b)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function createHmacToken(payload: TeamInviteTokenPayload): string {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac("sha256", hmacSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verifyHmacToken(token: string): TeamInviteVerifyResult {
  const [body, sig] = token.split(".", 2);
  if (!body || !sig) return { ok: false, error: "Malformed HMAC token" };
  const expected = b64urlEncode(createHmac("sha256", hmacSecret()).update(body).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return { ok: false, error: "Bad signature" };
  let diff = 0;
  for (let i = 0; i < sigBuf.length; i++) diff |= sigBuf[i]! ^ expBuf[i]!;
  if (diff !== 0) return { ok: false, error: "Bad signature" };
  let payload: TeamInviteTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "Unparseable HMAC payload" };
  }
  const e = validatePayload(payload, 1);
  if (e) return { ok: false, error: e };
  return { ok: true, payload, backend: "hmac" };
}

// ─── ML-DSA backend (lazy-imported so HMAC-only deploys don't pull in sigvault) ─

async function createMlDsaToken(payload: TeamInviteTokenPayload, keys: SigvaultKeys): Promise<string> {
  const { issueToken, MutationChain } = await import("@sigvault/sdk");
  // Single-shot chain per token issuance — counter-based replay protection
  // is enforced at the app layer (jti + DB membership check), not via shared chain state.
  const chain = new MutationChain(keys.encryptKey.slice(0, 32));
  const { tokenHex } = issueToken({
    signingKeySeed: keys.signingKey, // upstream issue #32 — `signingKey` arg also works
    encryptKey: keys.encryptKey,
    chain,
    claims: payload as unknown as Record<string, unknown>,
    ttl: payload.exp - payload.iat,
  });
  return tokenHex;
}

async function verifyMlDsaToken(token: string, keys: SigvaultKeys): Promise<TeamInviteVerifyResult> {
  try {
    const { verifyToken, MutationChain } = await import("@sigvault/sdk");
    const chain = new MutationChain(keys.encryptKey.slice(0, 32));
    const result = verifyToken({
      token,
      verifyingKey: keys.verifyingKey,
      encryptKey: keys.encryptKey,
      chain,
    });
    const payload = result.claims as unknown as TeamInviteTokenPayload;
    const e = validatePayload(payload, 2);
    if (e) return { ok: false, error: e };
    return { ok: true, payload, backend: "ml-dsa" };
  } catch (err: any) {
    return { ok: false, error: `ML-DSA verify failed: ${err?.message || String(err)}` };
  }
}

// ─── Shared payload validation ───────────────────────────────────────────────

function validatePayload(payload: any, expectedVersion: 1 | 2): string | null {
  if (!payload || typeof payload !== "object") return "Payload not an object";
  if (payload.v !== expectedVersion) return `Unsupported token version ${payload.v}`;
  if (!payload.orgId || !payload.email || !payload.role) return "Token missing required fields";
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return "Token expired";
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createTeamInviteToken(input: {
  orgId: string;
  email: string;
  name?: string;
  role: "broker_admin" | "broker_agent";
  expiresInDays?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttlSec = (input.expiresInDays ?? 14) * 24 * 60 * 60;
  const sv = await loadSigvaultKeys();
  const payload: TeamInviteTokenPayload = {
    v: sv ? 2 : 1,
    orgId: input.orgId,
    email: input.email.trim().toLowerCase(),
    name: input.name,
    role: input.role,
    iat: now,
    exp: now + ttlSec,
    jti: randomBytes(12).toString("hex"),
  };
  return sv ? createMlDsaToken(payload, sv) : createHmacToken(payload);
}

export async function verifyTeamInviteToken(token: string): Promise<TeamInviteVerifyResult> {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "Malformed token" };
  }
  // Format auto-detect: HMAC tokens have a `.` separator, ML-DSA tokens are pure hex.
  if (token.includes(".")) return verifyHmacToken(token);
  const sv = await loadSigvaultKeys();
  if (!sv) return { ok: false, error: "ML-DSA token received but no keys available (env vars + KeyMaterial both empty)" };
  return verifyMlDsaToken(token, sv);
}
