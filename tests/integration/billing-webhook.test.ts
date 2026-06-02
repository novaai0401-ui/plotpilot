/**
 * Razorpay webhook E2E.
 *
 * Synthesizes the exact request Razorpay would POST — HMAC-signed raw body,
 * real signature header — then invokes the route handler against a real
 * Postgres. Asserts the Organization row actually updated and an
 * AnalyticsEvent was logged.
 *
 * What this catches that the unit test couldn't:
 *   - planFromRazorpayPlanId lookup against env vars
 *   - Prisma's update writing the wrong columns
 *   - Replay protection actually persisting to WebhookEvent
 *   - 200 returned for unrecognized events (so Razorpay stops retrying)
 *
 * Skipped if DATABASE_URL is unset/fake — see tests/integration/setup.ts.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "@/app/api/billing/webhook/route";
import { prisma } from "@/lib/db/prisma";
import {
  SKIP_INTEGRATION,
  createTestOrg,
  resetDb,
  teardown,
} from "./setup";

const WEBHOOK_SECRET = "ci-webhook-secret-stable";
const PLAN_ID_PRO = "plan_TestProMonthly";
const PLAN_ID_ENTERPRISE = "plan_TestEnterpriseMonthly";

beforeAll(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO = PLAN_ID_PRO;
  process.env.RAZORPAY_PLAN_ID_ENTERPRISE = PLAN_ID_ENTERPRISE;
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await teardown();
});

/** Build a NextRequest the way Razorpay would send it. */
function razorpayRequest(eventBody: object): Request {
  const rawBody = JSON.stringify(eventBody);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": sig,
    },
    body: rawBody,
  });
}

/** Standard Razorpay event payload skeleton. */
function event(opts: {
  type: string;
  subscriptionId: string;
  planId?: string;
  orgId?: string;
  currentEnd?: number;
  eventId?: string;
}) {
  return {
    id: opts.eventId ?? `evt_${Math.random().toString(36).slice(2)}`,
    entity: "event",
    event: opts.type,
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      subscription: {
        entity: {
          id: opts.subscriptionId,
          plan_id: opts.planId ?? PLAN_ID_PRO,
          current_end:
            opts.currentEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400,
          notes: opts.orgId ? { orgId: opts.orgId } : {},
        },
      },
    },
  };
}

describe.skipIf(SKIP_INTEGRATION)("POST /api/billing/webhook", () => {
  it("rejects requests with no signature header", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: "{}",
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("rejects requests with a forged signature", async () => {
    const rawBody = JSON.stringify({ event: "subscription.activated" });
    const res = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": "0".repeat(64),
        },
        body: rawBody,
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("subscription.activated flips the org to active + pro plan", async () => {
    const org = await createTestOrg({ plan: "free" });
    const subId = `sub_${org.id.slice(0, 10)}`;

    const res = await POST(
      razorpayRequest(
        event({ type: "subscription.activated", subscriptionId: subId, orgId: org.id })
      ) as any
    );
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.plan).toBe("pro");
    expect(updated?.subscriptionStatus).toBe("active");
    expect(updated?.razorpaySubscriptionId).toBe(subId);
    expect(updated?.subscriptionEndsAt).toBeInstanceOf(Date);

    const analytics = await prisma.analyticsEvent.findFirst({
      where: { orgId: org.id, type: "billing.subscription.activated" },
    });
    expect(analytics).not.toBeNull();
  });

  it("subscription.charged extends subscriptionEndsAt", async () => {
    const org = await createTestOrg({
      plan: "pro",
      razorpaySubscriptionId: "sub_renew_test",
      subscriptionStatus: "active",
    });
    const newEnd = Math.floor(Date.now() / 1000) + 60 * 86400;

    const res = await POST(
      razorpayRequest(
        event({
          type: "subscription.charged",
          subscriptionId: "sub_renew_test",
          currentEnd: newEnd,
          orgId: org.id,
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.subscriptionEndsAt?.getTime()).toBe(newEnd * 1000);
  });

  it("subscription.cancelled marks status cancelled but keeps the plan", async () => {
    const org = await createTestOrg({
      plan: "pro",
      razorpaySubscriptionId: "sub_cancel_test",
      subscriptionStatus: "active",
    });

    const res = await POST(
      razorpayRequest(
        event({
          type: "subscription.cancelled",
          subscriptionId: "sub_cancel_test",
          orgId: org.id,
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    // Plan stays pro until period ends — a cron job downgrades after subscriptionEndsAt.
    expect(updated?.plan).toBe("pro");
    expect(updated?.subscriptionStatus).toBe("cancelled");
  });

  it("subscription.halted immediately downgrades to free", async () => {
    const org = await createTestOrg({
      plan: "pro",
      razorpaySubscriptionId: "sub_halt_test",
      subscriptionStatus: "active",
    });

    const res = await POST(
      razorpayRequest(
        event({
          type: "subscription.halted",
          subscriptionId: "sub_halt_test",
          orgId: org.id,
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.plan).toBe("free");
    expect(updated?.subscriptionStatus).toBe("halted");
  });

  it("rejects replays — duplicate event id returns 200 ignored without re-applying", async () => {
    const org = await createTestOrg({ plan: "free" });
    const subId = `sub_replay_${org.id.slice(0, 6)}`;
    const eventId = `evt_replay_unique_${Date.now()}`;

    const first = await POST(
      razorpayRequest(
        event({
          type: "subscription.activated",
          subscriptionId: subId,
          orgId: org.id,
          eventId,
        })
      ) as any
    );
    expect(first.status).toBe(200);

    // Downgrade by hand to detect re-application.
    await prisma.organization.update({
      where: { id: org.id },
      data: { plan: "free", subscriptionStatus: null },
    });

    const second = await POST(
      razorpayRequest(
        event({
          type: "subscription.activated",
          subscriptionId: subId,
          orgId: org.id,
          eventId, // same id → must be rejected as duplicate
        })
      ) as any
    );
    const body = await second.json();
    expect(second.status).toBe(200);
    expect(body.ignored).toBe("duplicate_event");

    // Org state unchanged from our manual downgrade — the replay did NOT re-activate.
    const afterReplay = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(afterReplay?.plan).toBe("free");
    expect(afterReplay?.subscriptionStatus).toBeNull();
  });

  it("ignores events for unknown subscriptions without erroring", async () => {
    const res = await POST(
      razorpayRequest(
        event({
          type: "subscription.activated",
          subscriptionId: "sub_no_such_org",
          // No orgId in notes either — handler should bail gracefully.
        })
      ) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBeDefined();
  });

  it("ignores unrecognized event types (no DB writes)", async () => {
    const org = await createTestOrg({ plan: "pro" });
    const res = await POST(
      razorpayRequest(
        event({
          type: "subscription.pending",
          subscriptionId: "sub_pending_test",
          orgId: org.id,
        })
      ) as any
    );
    expect(res.status).toBe(200);

    // No analytics row should have been written for an unhandled event.
    const analytics = await prisma.analyticsEvent.count({
      where: { orgId: org.id, type: "billing.subscription.pending" },
    });
    expect(analytics).toBe(0);
  });
});
