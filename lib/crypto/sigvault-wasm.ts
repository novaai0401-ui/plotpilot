/**
 * Isomorphic ML-DSA-87 wrapper around `@sigvault/wasm`.
 *
 * Why this exists at all (and not just the SDK):
 *   - `@sigvault/sdk` imports `node:zlib` (upstream issue #35), which breaks
 *     browser and edge-runtime bundles. The raw WASM has no such dep — just
 *     `qv_wasm.wasm` plus a single host import (`qv_host_random`) — so it
 *     stays usable in Cloudflare Workers, browsers, and PWA service workers.
 *
 * Why this is now ~50% smaller than the previous version:
 *   - `@sigvault/wasm` 4.3.9 ships a working `loadQV()` (4.3.8 was broken;
 *     fixed in https://github.com/007krcs/quantum-vault/issues/40). We
 *     delegate the actual instantiate + CSPRNG wiring to the upstream loader
 *     and only layer the high-level `keygen`/`sign`/`verify` API on top.
 *
 * What this DOESN'T do:
 *   - Token framing. The SDK's `issueToken()`/`verifyToken()` wrap the raw
 *     signature with XChaCha20-Poly1305 + ChainStore framing. We only expose
 *     the bare ML-DSA primitive. For browser-side verify of SDK-issued tokens
 *     the SDK would need to expose its framing as separate primitives — see
 *     INTEGRATION_NOTES.md "Integration gap" for the use case this blocks.
 *
 * Exports:
 *   - `getWasm()`               — lazy singleton loader
 *   - `keygen()`                — fresh ML-DSA-87 keypair
 *   - `sign(sk, msg)`           — detached signature
 *   - `verify(vk, msg, sig)`    — boolean
 *   - `SK_LEN, VK_LEN, SIG_LEN` — byte sizes (32 / 2592 / 4627)
 */

// NOTE: we don't `import type { QVExports } from "@sigvault/wasm"` because the
// package's `exports` map doesn't declare a `"types"` condition, so under
// NodeNext / bundler module resolution TS can't find the .d.ts. The upstream
// type is `[symbol: string]: any` anyway — zero information loss from
// ignoring it. Filing this as a separate small DX bug upstream.

export const SK_LEN = 32;
export const VK_LEN = 2592;
export const SIG_LEN = 4627;

/** Narrowed view of the wasm exports we actually call. */
type QVExports = {
  memory: WebAssembly.Memory;
  qv_wasm_alloc: (len: number) => number;
  qv_wasm_free: (ptr: number, len: number) => void;
  qv_wasm_keygen: (skPtr: number, vkPtr: number) => number;
  qv_wasm_sign: (
    skPtr: number,
    skLen: number,
    msgPtr: number,
    msgLen: number,
    sigPtr: number
  ) => number;
  qv_wasm_verify: (
    vkPtr: number,
    vkLen: number,
    msgPtr: number,
    msgLen: number,
    sigPtr: number,
    sigLen: number
  ) => number;
  qv_wasm_sk_len: () => number;
  qv_wasm_vk_len: () => number;
  qv_wasm_sig_len: () => number;
};

let instancePromise: Promise<QVExports> | null = null;

/**
 * Lazy singleton. First call instantiates the wasm module; subsequent calls
 * reuse it. Memory is module-scoped, so don't share buffer pointers across
 * awaits without copying.
 */
export function getWasm(): Promise<QVExports> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    // Upstream package.json `exports` map lacks a `"types"` condition, so
    // even under `moduleResolution: bundler` TS can't locate the bundled .d.ts.
    // Workaround until upstream adds it; the runtime import works fine.
    // @ts-expect-error — see comment above
    const { loadQV } = (await import("@sigvault/wasm")) as {
      loadQV: (source?: URL | string | Uint8Array) => Promise<QVExports>;
    };
    // Browser path needs the .wasm URL explicitly so bundlers emit the asset
    // (Webpack 5, Vite, Turbopack all understand `new URL(..., import.meta.url)`).
    // Node path: `loadQV()` with no args auto-resolves the .wasm next to the loader.
    const IS_NODE =
      typeof process !== "undefined" && process.versions?.node != null;
    const exports = IS_NODE
      ? await loadQV()
      : await loadQV(new URL("@sigvault/wasm/qv_wasm.wasm", import.meta.url));
    return exports as QVExports;
  })();
  return instancePromise;
}

/** Generate a fresh ML-DSA-87 keypair. */
export async function keygen(): Promise<{ signingKey: Uint8Array; verifyingKey: Uint8Array }> {
  const x = await getWasm();
  const skPtr = x.qv_wasm_alloc(SK_LEN);
  const vkPtr = x.qv_wasm_alloc(VK_LEN);
  try {
    const status = x.qv_wasm_keygen(skPtr, vkPtr);
    if (status !== 0) throw new Error(`qv_wasm_keygen failed: ${status}`);
    return {
      signingKey: new Uint8Array(x.memory.buffer, skPtr, SK_LEN).slice(),
      verifyingKey: new Uint8Array(x.memory.buffer, vkPtr, VK_LEN).slice(),
    };
  } finally {
    x.qv_wasm_free(skPtr, SK_LEN);
    x.qv_wasm_free(vkPtr, VK_LEN);
  }
}

/** Detached ML-DSA-87 signature over `msg`. */
export async function sign(signingKey: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  if (signingKey.length !== SK_LEN) {
    throw new Error(`signingKey must be ${SK_LEN} bytes, got ${signingKey.length}`);
  }
  const x = await getWasm();
  const skPtr = x.qv_wasm_alloc(SK_LEN);
  const msgPtr = x.qv_wasm_alloc(msg.length || 1); // some wasm builds reject len-0 alloc
  const sigPtr = x.qv_wasm_alloc(SIG_LEN);
  try {
    new Uint8Array(x.memory.buffer, skPtr, SK_LEN).set(signingKey);
    if (msg.length) new Uint8Array(x.memory.buffer, msgPtr, msg.length).set(msg);
    const status = x.qv_wasm_sign(skPtr, SK_LEN, msgPtr, msg.length, sigPtr);
    if (status !== 0) throw new Error(`qv_wasm_sign failed: ${status}`);
    return new Uint8Array(x.memory.buffer, sigPtr, SIG_LEN).slice();
  } finally {
    x.qv_wasm_free(skPtr, SK_LEN);
    x.qv_wasm_free(msgPtr, msg.length || 1);
    x.qv_wasm_free(sigPtr, SIG_LEN);
  }
}

/** Returns true iff `sig` is a valid ML-DSA-87 signature over `msg` by `vk`. */
export async function verify(
  verifyingKey: Uint8Array,
  msg: Uint8Array,
  sig: Uint8Array
): Promise<boolean> {
  if (verifyingKey.length !== VK_LEN) return false;
  if (sig.length !== SIG_LEN) return false;
  const x = await getWasm();
  const vkPtr = x.qv_wasm_alloc(VK_LEN);
  const msgPtr = x.qv_wasm_alloc(msg.length || 1);
  const sigPtr = x.qv_wasm_alloc(SIG_LEN);
  try {
    new Uint8Array(x.memory.buffer, vkPtr, VK_LEN).set(verifyingKey);
    if (msg.length) new Uint8Array(x.memory.buffer, msgPtr, msg.length).set(msg);
    new Uint8Array(x.memory.buffer, sigPtr, SIG_LEN).set(sig);
    const status = x.qv_wasm_verify(vkPtr, VK_LEN, msgPtr, msg.length, sigPtr, SIG_LEN);
    return status === 1;
  } finally {
    x.qv_wasm_free(vkPtr, VK_LEN);
    x.qv_wasm_free(msgPtr, msg.length || 1);
    x.qv_wasm_free(sigPtr, SIG_LEN);
  }
}
