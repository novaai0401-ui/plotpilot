import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeypair } from "@sigvault/sdk";
import {
  __resetSigvaultKeyCache_TEST_ONLY,
  createTeamInviteToken,
  verifyTeamInviteToken,
} from "@/lib/auth/team-invite-token";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

/** Production signs with ML-DSA, and sigvault hands every claim back as a string. */
describe("team-invite-token (ML-DSA backend)", () => {
  beforeAll(() => {
    const keys = generateKeypair();
    process.env.TEAM_INVITE_SIGNING_KEY = hex(keys.signingKey);
    process.env.TEAM_INVITE_VERIFYING_KEY = hex(keys.verifyingKey);
    process.env.TEAM_INVITE_ENCRYPT_KEY = hex(keys.encryptKey);
    __resetSigvaultKeyCache_TEST_ONLY();
  });
  afterAll(() => {
    delete process.env.TEAM_INVITE_SIGNING_KEY;
    delete process.env.TEAM_INVITE_VERIFYING_KEY;
    delete process.env.TEAM_INVITE_ENCRYPT_KEY;
    __resetSigvaultKeyCache_TEST_ONLY();
  });

  it("round-trips a token with numeric fields intact", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_abc",
      email: "alice@example.com",
      name: "Alice",
      role: "broker_agent",
    });
    expect(token).not.toContain(".");

    const v = await verifyTeamInviteToken(token);
    expect(v).toMatchObject({ ok: true, backend: "ml-dsa" });
    if (v.ok) {
      expect(v.payload.v).toBe(2);
      expect(typeof v.payload.exp).toBe("number");
      expect(v.payload.email).toBe("alice@example.com");
    }
  });

  it("still rejects a tampered token", async () => {
    const token = await createTeamInviteToken({
      orgId: "org_abc",
      email: "alice@example.com",
      name: "Alice",
      role: "broker_agent",
    });
    const flipped = token.endsWith("0") ? "1" : "0";
    const v = await verifyTeamInviteToken(token.slice(0, -1) + flipped);
    expect(v.ok).toBe(false);
  });
});
