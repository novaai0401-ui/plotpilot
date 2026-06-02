import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTeamInviteToken,
  verifyTeamInviteToken,
} from "@/lib/auth/team-invite-token";

/**
 * Coverage focus:
 *  - Both backends (HMAC fallback, ML-DSA when keys set) round-trip cleanly.
 *  - Verifier auto-detects backend by token format (presence of `.` vs pure hex).
 *  - Expired tokens fail with an `expired`-ish message (the /signup preview
 *    keys off that string to decide between "expired" and "invalid" screens).
 *  - Tampered tokens fail.
 *
 * We don't test ML-DSA in this file unless the env vars happen to be set —
 * the SDK path is exercised by the wrapper roundtrip in
 * `tests/lib/crypto/sigvault-wasm.test.ts`. Here we just confirm the
 * **HMAC fallback** path that powers most local-dev deploys.
 */

describe("team-invite-token (HMAC backend)", () => {
  const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
  beforeAll(() => {
    // Ensure ENCRYPTION_KEY is present and ML-DSA keys are NOT — forces HMAC path.
    process.env.ENCRYPTION_KEY =
      ORIGINAL_KEY || "0123456789abcdef0123456789abcdef";
    delete process.env.TEAM_INVITE_SIGNING_KEY;
    delete process.env.TEAM_INVITE_VERIFYING_KEY;
    delete process.env.TEAM_INVITE_ENCRYPT_KEY;
  });
  afterAll(() => {
    if (ORIGINAL_KEY !== undefined) process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("round-trips a token", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_abc",
      email: "alice@example.com",
      name: "Alice",
      role: "broker_agent",
      expiresInDays: 14,
    });
    expect(typeof token).toBe("string");
    // HMAC format is `<body>.<sig>`.
    expect(token).toContain(".");

    const v = await verifyTeamInviteToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.backend).toBe("hmac");
      expect(v.payload.orgId).toBe("org_abc");
      expect(v.payload.email).toBe("alice@example.com");
      expect(v.payload.role).toBe("broker_agent");
      expect(v.payload.name).toBe("Alice");
      expect(v.payload.v).toBe(1);
      expect(typeof v.payload.jti).toBe("string");
    }
  });

  it("normalizes email to lowercase", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_x",
      email: "MixedCase@Example.COM",
      role: "broker_admin",
    });
    const v = await verifyTeamInviteToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.email).toBe("mixedcase@example.com");
  });

  it("rejects a tampered signature", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_x",
      email: "bob@example.com",
      role: "broker_agent",
    });
    // Flip a byte in the signature half (after the `.`)
    const [body, sig] = token.split(".");
    const tampered = `${body}.${sig.slice(0, -2)}AA`;
    const v = await verifyTeamInviteToken(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/signature/i);
  });

  it("rejects a tampered payload", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_x",
      email: "bob@example.com",
      role: "broker_agent",
    });
    // Change the body, leave the sig — won't validate.
    const [, sig] = token.split(".");
    const fakeBody = Buffer.from(
      JSON.stringify({
        v: 1,
        orgId: "org_attacker",
        email: "bob@example.com",
        role: "broker_admin",
        iat: 1,
        exp: 9_999_999_999,
        jti: "deadbeef",
      })
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const v = await verifyTeamInviteToken(`${fakeBody}.${sig}`);
    expect(v.ok).toBe(false);
  });

  it("rejects malformed tokens without throwing", async () => {
    const cases = ["", "no-dot-here", "...", "a.", ".b"];
    for (const t of cases) {
      const v = await verifyTeamInviteToken(t);
      expect(v.ok).toBe(false);
    }
  });

  it("flags an expired token with /expired/i — the /signup preview keys off this", async () => {
    // Manually forge a payload with exp in the past, signed with the real HMAC key,
    // so the signature is valid but the expiry check fails.
    const { createHmac } = await import("node:crypto");
    const past = Math.floor(Date.now() / 1000) - 60;
    const payload = {
      v: 1 as const,
      orgId: "org_x",
      email: "ghost@example.com",
      role: "broker_agent" as const,
      iat: past - 100,
      exp: past,
      jti: "expired-test",
    };
    const body = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const sig = createHmac("sha256", Buffer.from(process.env.ENCRYPTION_KEY!))
      .update(body)
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const v = await verifyTeamInviteToken(`${body}.${sig}`);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/expired/i);
  });
});
