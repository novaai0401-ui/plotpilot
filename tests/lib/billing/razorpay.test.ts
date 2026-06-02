import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";

// Load module fresh per test so env changes are picked up
async function loadModule() {
  vi.resetModules();
  return await import("@/lib/billing/razorpay");
}

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test_abc123";
  const rawBody = JSON.stringify({ event: "subscription.activated", id: "sub_xyz" });
  const validSig = createHmac("sha256", secret).update(rawBody).digest("hex");

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  });
  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("accepts a valid signature", async () => {
    const { verifyWebhookSignature } = await loadModule();
    expect(verifyWebhookSignature(rawBody, validSig)).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { verifyWebhookSignature } = await loadModule();
    const wrongSig = validSig.replace(/^./, validSig[0] === "a" ? "b" : "a");
    expect(verifyWebhookSignature(rawBody, wrongSig)).toBe(false);
  });

  it("rejects a signature for a different body", async () => {
    const { verifyWebhookSignature } = await loadModule();
    expect(verifyWebhookSignature("{}", validSig)).toBe(false);
  });

  it("rejects when secret env var is missing", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const { verifyWebhookSignature } = await loadModule();
    expect(verifyWebhookSignature(rawBody, validSig)).toBe(false);
  });

  it("uses constant-time comparison (length mismatch still returns false)", async () => {
    const { verifyWebhookSignature } = await loadModule();
    expect(verifyWebhookSignature(rawBody, "short")).toBe(false);
  });
});

describe("planFromRazorpayPlanId", () => {
  beforeEach(() => {
    process.env.RAZORPAY_PLAN_ID_PRO = "plan_pro_123";
    process.env.RAZORPAY_PLAN_ID_ENTERPRISE = "plan_ent_456";
  });
  afterEach(() => {
    delete process.env.RAZORPAY_PLAN_ID_PRO;
    delete process.env.RAZORPAY_PLAN_ID_ENTERPRISE;
  });

  it("maps known plan ids to our enum", async () => {
    const { planFromRazorpayPlanId } = await loadModule();
    expect(planFromRazorpayPlanId("plan_pro_123")).toBe("pro");
    expect(planFromRazorpayPlanId("plan_ent_456")).toBe("enterprise");
  });

  it("returns null for unknown plan ids", async () => {
    const { planFromRazorpayPlanId } = await loadModule();
    expect(planFromRazorpayPlanId("plan_unknown")).toBeNull();
  });
});

describe("isRazorpayConfigured", () => {
  it("returns true when all env vars are set", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "x";
    process.env.RAZORPAY_PLAN_ID_PRO = "plan_pro";
    process.env.RAZORPAY_PLAN_ID_ENTERPRISE = "plan_ent";
    const { isRazorpayConfigured } = await loadModule();
    expect(isRazorpayConfigured()).toBe(true);
  });

  it("returns false when any env var is missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    const { isRazorpayConfigured } = await loadModule();
    expect(isRazorpayConfigured()).toBe(false);
  });
});
