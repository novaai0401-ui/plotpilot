import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import type { OrgPlan } from "@prisma/client";

let cached: Razorpay | null = null;

export function razorpayClient(): Razorpay | null {
  if (cached) return cached;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  cached = new Razorpay({ key_id, key_secret });
  return cached;
}

export function isRazorpayConfigured(): boolean {
  return !!(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_PLAN_ID_PRO &&
    process.env.RAZORPAY_PLAN_ID_ENTERPRISE
  );
}

export function planIdFor(plan: OrgPlan): string | null {
  if (plan === "pro") return process.env.RAZORPAY_PLAN_ID_PRO || null;
  if (plan === "enterprise") return process.env.RAZORPAY_PLAN_ID_ENTERPRISE || null;
  return null; // free has no plan id
}

/**
 * Map a Razorpay plan_id back to our OrgPlan enum. Used by webhook handler
 * because the webhook gives us the plan_id, not the plan name.
 */
export function planFromRazorpayPlanId(rzpPlanId: string): OrgPlan | null {
  if (rzpPlanId === process.env.RAZORPAY_PLAN_ID_PRO) return "pro";
  if (rzpPlanId === process.env.RAZORPAY_PLAN_ID_ENTERPRISE) return "enterprise";
  return null;
}

/**
 * Verify the webhook signature Razorpay sends in X-Razorpay-Signature.
 * Uses constant-time comparison to avoid timing attacks.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
