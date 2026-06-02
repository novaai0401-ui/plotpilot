/**
 * Integration test harness.
 *
 * These tests exercise real API route handlers against a real Postgres. The
 * difference from `tests/lib/*` (pure-function unit tests) is that Prisma
 * actually runs queries here — so we catch the things mocks can't:
 *   - Wrong .where() filters
 *   - Missing .include() relations
 *   - Constraint violations
 *   - Cascade/onDelete behavior surprises
 *   - Auth-bypass paths
 *
 * ── Local dev ────────────────────────────────────────────────────────────
 *   1. Start a Postgres (any way you like — Docker is easiest):
 *        docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
 *   2. Set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test
 *   3. Push schema:        npx prisma db push --skip-generate --accept-data-loss
 *   4. Run integration:    npx vitest run tests/integration
 *
 *   If DATABASE_URL is unset or points at a fake host, integration tests are
 *   skipped (not failed) — so `npm test` still works without a DB.
 *
 * ── CI ──────────────────────────────────────────────────────────────────
 *   `.github/workflows/test.yml` spins up a Postgres service container and
 *   runs `npx vitest run tests/integration` in a dedicated job.
 */

import { prisma } from "@/lib/db/prisma";

/** True iff DATABASE_URL is missing or obviously a fake placeholder. */
export const SKIP_INTEGRATION =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("fake") ||
  // Don't try to truncate the user's real prod DB by accident.
  /supabase\.co|aws\.|gcp\.|prod/i.test(process.env.DATABASE_URL || "");

/**
 * Table list, ordered such that TRUNCATE … CASCADE works without surprises.
 * Pulled from `prisma/schema.prisma` — keep in sync when models are added.
 */
const TABLES = [
  "WebhookEvent",
  "AnalyticsEvent",
  "Notification",
  "UsageEvent",
  "BuildingDesign",
  "DesignCache",
  "Message",
  "Visit",
  "Plot",
  "Invitation",
  "User",
  "WhatsAppConfig",
  "Organization",
];

/**
 * Wipe all tenant data between tests. Schema stays — only rows go.
 * Identity sequences reset so generated IDs stay stable run-to-run.
 */
export async function resetDb(): Promise<void> {
  if (SKIP_INTEGRATION) return;
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );
}

/**
 * Disconnect Prisma at suite end. Without this, vitest's worker pool can hang
 * waiting on open connections.
 */
export async function teardown(): Promise<void> {
  if (SKIP_INTEGRATION) return;
  await prisma.$disconnect();
}

// ── Factory helpers ─────────────────────────────────────────────────────────

let _counter = 0;
function uniq(s: string): string {
  _counter += 1;
  return `${s}-${process.pid}-${Date.now()}-${_counter}`;
}

/**
 * Insert an Organization with a unique slug. Returns the row.
 * Override fields via `overrides`.
 */
export async function createTestOrg(overrides: Partial<{
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
}> = {}) {
  return prisma.organization.create({
    data: {
      name: overrides.name ?? "Test Brokerage",
      slug: overrides.slug ?? uniq("test-org"),
      plan: overrides.plan ?? "free",
      razorpaySubscriptionId: overrides.razorpaySubscriptionId ?? null,
      subscriptionStatus: overrides.subscriptionStatus ?? null,
      whatsappConfig: { create: {} },
    },
  });
}

/**
 * Insert a broker_admin User attached to an org. Sets a unique authId/email/phone
 * so multiple users can coexist in the same test.
 */
export async function createTestUser(orgId: string, overrides: Partial<{
  role: "broker_admin" | "broker_agent" | "client" | "super_admin";
  name: string;
  email: string | null;
  phone: string;
}> = {}) {
  return prisma.user.create({
    data: {
      authId: uniq("auth"),
      orgId,
      role: overrides.role ?? "broker_admin",
      name: overrides.name ?? "Test User",
      email: overrides.email === null ? null : overrides.email ?? uniq("test") + "@example.com",
      phone: overrides.phone ?? `+9199${Math.floor(Math.random() * 100_000_000)}`,
    },
  });
}
