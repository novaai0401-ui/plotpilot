import { describe, it, expect } from "vitest";
import { keygen, sign, verify, SK_LEN, VK_LEN, SIG_LEN } from "@/lib/crypto/sigvault-wasm";

describe("sigvault-wasm (ML-DSA-87)", () => {
  it("reports the published key/sig sizes", () => {
    expect(SK_LEN).toBe(32);
    expect(VK_LEN).toBe(2592);
    expect(SIG_LEN).toBe(4627);
  });

  it("generates a keypair of the right shape", async () => {
    const kp = await keygen();
    expect(kp.signingKey).toBeInstanceOf(Uint8Array);
    expect(kp.verifyingKey).toBeInstanceOf(Uint8Array);
    expect(kp.signingKey.length).toBe(SK_LEN);
    expect(kp.verifyingKey.length).toBe(VK_LEN);
  });

  it("generates distinct keypairs each call", async () => {
    const a = await keygen();
    const b = await keygen();
    expect(Buffer.from(a.signingKey).equals(Buffer.from(b.signingKey))).toBe(false);
    expect(Buffer.from(a.verifyingKey).equals(Buffer.from(b.verifyingKey))).toBe(false);
  });

  it("round-trips sign → verify", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const msg = new TextEncoder().encode("team-invite-payload-v1");
    const sig = await sign(signingKey, msg);
    expect(sig.length).toBe(SIG_LEN);
    expect(await verify(verifyingKey, msg, sig)).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const msg = new TextEncoder().encode("payload");
    const sig = await sign(signingKey, msg);
    const tampered = new Uint8Array(sig);
    tampered[0] ^= 0xff;
    expect(await verify(verifyingKey, msg, tampered)).toBe(false);
  });

  it("rejects a signature against the wrong message", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const sig = await sign(signingKey, new TextEncoder().encode("original"));
    expect(await verify(verifyingKey, new TextEncoder().encode("forged"), sig)).toBe(false);
  });

  it("rejects a signature against the wrong verifying key", async () => {
    const a = await keygen();
    const b = await keygen();
    const msg = new TextEncoder().encode("hi");
    const sig = await sign(a.signingKey, msg);
    expect(await verify(b.verifyingKey, msg, sig)).toBe(false);
  });

  it("rejects malformed key/sig sizes without throwing", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const msg = new TextEncoder().encode("x");
    const sig = await sign(signingKey, msg);

    expect(await verify(new Uint8Array(10), msg, sig)).toBe(false);
    expect(await verify(verifyingKey, msg, new Uint8Array(10))).toBe(false);

    await expect(sign(new Uint8Array(10), msg)).rejects.toThrow(/signingKey/);
  });

  it("handles empty messages", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const empty = new Uint8Array(0);
    const sig = await sign(signingKey, empty);
    expect(await verify(verifyingKey, empty, sig)).toBe(true);
  });

  it("handles long messages (4 KB)", async () => {
    const { signingKey, verifyingKey } = await keygen();
    const big = new Uint8Array(4096);
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff;
    const sig = await sign(signingKey, big);
    expect(await verify(verifyingKey, big, sig)).toBe(true);
  });
});
