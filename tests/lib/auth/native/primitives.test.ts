import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "@/lib/auth/native/password";
import {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  totpAuthUri,
  generateRecoveryCodes,
} from "@/lib/auth/native/totp";
import { mintToken, hashTokenSha256 } from "@/lib/auth/native/tokens";

describe("scrypt password", () => {
  it("round-trips a typical password", async () => {
    const stored = await hashPassword("hunter2hunter2");
    expect(stored).toMatch(/^scrypt\$/);
    expect(await verifyPassword("hunter2hunter2", stored)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("nope-nope-nope", stored)).toBe(false);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  it("two hashes of the same password differ (salt randomness)", async () => {
    const a = await hashPassword("samepasswordsame");
    const b = await hashPassword("samepasswordsame");
    expect(a).not.toBe(b);
  });

  it("refuses passwords shorter than 8 chars", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/8 characters/);
  });

  it("needsRehash returns false on current defaults", async () => {
    const stored = await hashPassword("aaaabbbbcccc");
    expect(needsRehash(stored)).toBe(false);
  });

  it("needsRehash returns true on legacy params", () => {
    // Synthetic legacy hash with N=4096
    const legacy = "scrypt$4096$8$1$" + "00".repeat(16) + "$" + "00".repeat(64);
    expect(needsRehash(legacy)).toBe(true);
  });
});

describe("TOTP (RFC 6238)", () => {
  it("generates a base32 secret of expected length", () => {
    const s = generateTotpSecret();
    // 160 bits = 32 base32 chars (no padding)
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("verifies the current code", () => {
    const secret = generateTotpSecret();
    const now = new Date();
    const code = generateTotp(secret, now);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it("accepts the previous 30-second window (clock skew)", () => {
    const secret = generateTotpSecret();
    const t0 = new Date(1_700_000_000_000);
    const code = generateTotp(secret, t0);
    // 25 seconds later — same window
    expect(verifyTotp(secret, code, new Date(t0.getTime() + 25_000))).toBe(true);
    // 35 seconds later — next window, but we allow ±1 step → accepted
    expect(verifyTotp(secret, code, new Date(t0.getTime() + 35_000))).toBe(true);
    // 90 seconds later — outside tolerance
    expect(verifyTotp(secret, code, new Date(t0.getTime() + 90_000))).toBe(false);
  });

  it("rejects non-6-digit codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345", new Date())).toBe(false);
    expect(verifyTotp(secret, "abcdef", new Date())).toBe(false);
    expect(verifyTotp(secret, "", new Date())).toBe(false);
  });

  it("rejects a code from a different secret", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    const now = new Date();
    expect(verifyTotp(b, generateTotp(a, now), now)).toBe(false);
  });

  it("builds a valid otpauth URI", () => {
    const uri = totpAuthUri({ secret: "JBSWY3DPEHPK3PXP", account: "alice@example.com", issuer: "PlotBroker" });
    expect(uri).toContain("otpauth://totp/PlotBroker:alice%40example.com");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=PlotBroker");
    expect(uri).toContain("algorithm=SHA1");
  });

  it("emits 8 distinct recovery codes by default", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{10}$/);
  });

  it("known-answer vector: RFC 6238 Appendix B (SHA1, T=59s → 287082)", () => {
    // RFC 6238 Appendix B test vector. Secret = ASCII "12345678901234567890"
    // = base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ. RFC expects 94287082 (8 digits);
    // truncated to 6 digits → 287082.
    const code = generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", new Date(59_000));
    expect(code).toBe("287082");
  });
});

describe("token mint", () => {
  it("returns a prefix + base32 body + sha256 hash", () => {
    const t = mintToken("pbs_", 32);
    expect(t.rawToken.startsWith("pbs_")).toBe(true);
    expect(t.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.last4).toBe(t.rawToken.slice(-4));
  });

  it("sha256 of rawToken matches the precomputed hash", () => {
    const t = mintToken("xx_");
    expect(hashTokenSha256(t.rawToken)).toBe(t.tokenHash);
  });

  it("two mints differ", () => {
    expect(mintToken("p_").rawToken).not.toBe(mintToken("p_").rawToken);
  });
});
