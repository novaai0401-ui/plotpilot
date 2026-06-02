import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { razorpayClient } from "@/lib/billing/razorpay";

/**
 * Cancel the org's active subscription at end of current billing period.
 * The webhook handler will then receive `subscription.cancelled` and set the row state.
 */
export async function POST() {
  const user = await requireUser(["broker_admin"]);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org?.razorpaySubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }
  const client = razorpayClient();
  if (!client) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  // cancel_at_cycle_end=true → don't refund, just stop renewing
  await client.subscriptions.cancel(org.razorpaySubscriptionId, true);

  return NextResponse.json({ ok: true, willEndAt: org.subscriptionEndsAt });
}
