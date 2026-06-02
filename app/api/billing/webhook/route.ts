import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyWebhookSignature, planFromRazorpayPlanId } from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook receiver.
 *
 * Events we care about:
 *  - subscription.activated   → plan becomes effective (first successful payment)
 *  - subscription.charged     → renewal succeeded; extend subscriptionEndsAt
 *  - subscription.cancelled   → user cancelled; downgrade at period end
 *  - subscription.halted      → payment failed multiple times; revoke plan now
 *  - subscription.paused      → temporary suspension; treat as halted
 *
 * Subscribe to these in Razorpay Dashboard → Webhooks. URL: /api/billing/webhook
 *
 * SECURITY: validates X-Razorpay-Signature using HMAC-SHA256 + constant-time compare.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Razorpay signs the raw body bytes — we must read text() (not json()) before parsing.
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ---- Replay protection ----
  // Razorpay sends a stable event id per delivery. Track consumed ids in WebhookEvent
  // and reject duplicates. Without this, a captured request can be replayed against us.
  const externalId =
    payload.id || // razorpay v1
    payload.event_id || // some webhook flavors
    `${payload.event}:${payload.created_at}:${payload.payload?.subscription?.entity?.id || ""}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "razorpay",
        externalId,
        payload: payload as any,
      },
    });
  } catch (e: any) {
    // Unique constraint violation = replay attempt; respond 200 so Razorpay stops retrying.
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: true, ignored: "duplicate_event", externalId });
    }
    throw e;
  }

  const event = String(payload.event || "");
  const sub = payload.payload?.subscription?.entity;
  if (!sub || !sub.id) {
    // Some events (payment.captured, etc.) we don't care about — 200 to avoid retries.
    return NextResponse.json({ ok: true, ignored: event });
  }

  // Match org by stored subscription id, or fall back to the notes.orgId we set on creation
  const orgId =
    sub.notes?.orgId ||
    (await prisma.organization
      .findFirst({ where: { razorpaySubscriptionId: sub.id }, select: { id: true } })
      .then((o) => o?.id));

  if (!orgId) {
    console.warn(`[razorpay-webhook] no org for subscription ${sub.id}`);
    return NextResponse.json({ ok: true, ignored: "no matching org" });
  }

  const plan = planFromRazorpayPlanId(sub.plan_id) || "free";
  const periodEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;

  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed": {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan,
          subscriptionStatus: "active",
          subscriptionEndsAt: periodEnd,
          razorpaySubscriptionId: sub.id,
        },
      });
      await prisma.analyticsEvent.create({
        data: { orgId, type: `billing.${event}`, metadata: { plan, periodEnd } },
      });
      break;
    }
    case "subscription.cancelled": {
      // Keep the plan effective until the paid period ends; cron downgrades after.
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          subscriptionStatus: "cancelled",
          subscriptionEndsAt: periodEnd,
        },
      });
      await prisma.analyticsEvent.create({
        data: { orgId, type: "billing.cancelled", metadata: { periodEnd } },
      });
      break;
    }
    case "subscription.halted":
    case "subscription.paused": {
      // Payment failures or pause — revoke plan immediately to prevent abuse
      await prisma.organization.update({
        where: { id: orgId },
        data: { plan: "free", subscriptionStatus: event.split(".")[1] },
      });
      await prisma.analyticsEvent.create({
        data: { orgId, type: `billing.${event}` },
      });
      break;
    }
    default:
      // Ignore other events
      break;
  }

  return NextResponse.json({ ok: true, event, orgId });
}
