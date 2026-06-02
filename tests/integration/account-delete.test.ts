/**
 * Self-serve account deletion E2E (DPDPA / GDPR).
 *
 * Auth is normally enforced by `requireUser()` redirecting to /login when
 * there's no Supabase session. In tests we bypass that by stubbing the
 * session helper to return a real DB user we created — see `withSession()`.
 *
 * Covers:
 *   - Rejection without confirmation slug match
 *   - Cascade delete: Org + Users + Plots + Visits + Designs all gone
 *   - Audit trail emitted to stderr (captured via console.warn spy)
 *   - Idempotency: deleting twice doesn't error
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  SKIP_INTEGRATION,
  createTestOrg,
  createTestUser,
  resetDb,
  teardown,
} from "./setup";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await teardown();
});

/**
 * Stub `getSessionUser` so the route handler sees the test user we just created.
 * Uses vi.doMock so the mock survives across the dynamic import inside the route.
 */
async function withSession<T>(
  user: { id: string; authId: string; orgId: string; role: string; name: string; email: string | null; phone: string },
  fn: () => Promise<T>
): Promise<T> {
  vi.resetModules();
  vi.doMock("@/lib/auth/session", () => ({
    getSessionUser: vi.fn().mockResolvedValue(user),
    requireUser: vi.fn().mockResolvedValue(user),
    ADMIN_ROLES: ["broker_admin", "broker_agent", "super_admin"],
    BROKER_ROLES: ["broker_admin", "broker_agent"],
  }));
  try {
    return await fn();
  } finally {
    vi.doUnmock("@/lib/auth/session");
    vi.resetModules();
  }
}

async function callDelete(body: object): Promise<Response> {
  const { POST } = await import("@/app/api/account/delete/route");
  return POST(
    new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as any
  );
}

describe.skipIf(SKIP_INTEGRATION)("POST /api/account/delete", () => {
  it("rejects when confirmSlug doesn't match", async () => {
    const org = await createTestOrg({ slug: "real-slug-xyz" });
    const admin = await createTestUser(org.id, { role: "broker_admin" });

    const res = await withSession(admin, () =>
      callDelete({ confirmSlug: "wrong-slug" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/doesn't match/i);

    // Org still exists.
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
  });

  it("cascade-deletes the org + every child row when confirmSlug matches", async () => {
    const org = await createTestOrg({ slug: "doomed-org" });
    const admin = await createTestUser(org.id, { role: "broker_admin" });
    const agent = await createTestUser(org.id, { role: "broker_agent" });
    const client = await createTestUser(org.id, { role: "client" });

    // Seed some Org-child data so we can prove the cascade fires.
    const plot = await prisma.plot.create({
      data: {
        orgId: org.id,
        title: "Test Plot",
        location: "Bangalore",
        priceInr: 5_000_000,
        sizeSqft: 1200,
      },
    });
    await prisma.visit.create({
      data: {
        orgId: org.id,
        plotId: plot.id,
        clientId: client.id,
        agentId: agent.id,
        scheduledAt: new Date(),
        status: "scheduled",
      },
    });
    await prisma.analyticsEvent.create({
      data: { orgId: org.id, type: "test.precondition" },
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await withSession(admin, () =>
      callDelete({ confirmSlug: "doomed-org" })
    );
    expect(res.status).toBe(200);

    // Org and every related row should be gone.
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
    expect(await prisma.user.count({ where: { orgId: org.id } })).toBe(0);
    expect(await prisma.plot.count({ where: { orgId: org.id } })).toBe(0);
    expect(await prisma.visit.count({ where: { orgId: org.id } })).toBe(0);
    expect(await prisma.analyticsEvent.count({ where: { orgId: org.id } })).toBe(0);

    // Structured audit line must have been emitted.
    const auditCalls = warn.mock.calls.filter((c) =>
      String(c[0] || "").includes('"audit":"account.deleted"')
    );
    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(String(auditCalls[0][0]));
    expect(parsed.orgId).toBe(org.id);
    expect(parsed.orgSlug).toBe("doomed-org");
    expect(parsed.actorUserId).toBe(admin.id);
    expect(parsed.counts.users).toBeGreaterThan(0);

    warn.mockRestore();
  });

  it("returns ok with alreadyDeleted=true if the org is already gone", async () => {
    const org = await createTestOrg({ slug: "ghost-org" });
    const admin = await createTestUser(org.id, { role: "broker_admin" });
    // Race condition simulation: delete the org out from under the request.
    await prisma.organization.delete({ where: { id: org.id } });

    const res = await withSession(admin, () =>
      callDelete({ confirmSlug: "ghost-org" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyDeleted).toBe(true);
  });
});
