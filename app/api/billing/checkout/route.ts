import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  isRazorpayConfigured,
  razorpayClient,
  planIdFor,
} from "@/lib/billing/razorpay";
import type { OrgPlan } from "@prisma/client";

/**
 * Create (or re-use) a Razorpay subscription for the caller's org.
 *
 * Body: { plan: "pro" | "enterprise" }
 * Returns: { subscriptionId, keyId } — frontend hands these to Razorpay Checkout JS.
 *
 * The actual plan switch happens on `subscription.activated` webhook, not here.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(["broker_admin"]); // only owner can subscribe
  const body = await req.json().catch(() => ({}));
  const plan = body.plan as OrgPlan;
  if (plan !== "pro" && plan !== "enterprise") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Billing not configured — set RAZORPAY_* env vars." },
      { status: 503 }
    );
  }
  const planId = planIdFor(plan);
  if (!planId) {
    return NextResponse.json({ error: "No Razorpay plan id for tier " + plan }, { status: 400 });
  }

  const client = razorpayClient()!;
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // If there's already an active subscription, return it instead of duplicating
  if (org.razorpaySubscriptionId && org.subscriptionStatus === "active") {
    return NextResponse.json({
      subscriptionId: org.razorpaySubscriptionId,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      alreadyActive: true,
    });
  }

  // Create a new subscription. `total_count: 120` = bill monthly for 10 years (effectively forever).
  const subscription: any = await client.subscriptions.create({
    plan_id: planId,
    total_count: 120,
    customer_notify: 1,
    notes: { orgId: org.id, orgSlug: org.slug, requestedPlan: plan },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      razorpaySubscriptionId: subscription.id,
      subscriptionStatus: subscription.status, // typically "created" until first payment
    },
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
