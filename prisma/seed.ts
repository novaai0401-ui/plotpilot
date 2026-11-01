import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "../lib/auth/native/password";
import { runDailyInsights } from "../lib/insights/service";
import { buildSampleHistory } from "./sample-history";

const prisma = new PrismaClient();

// Shared login for the seeded demo users. Demo data only — override with
// DEMO_PASSWORD on any database reachable from the internet.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@12345";

async function main() {
  console.log("Seeding...");

  const org = await prisma.organization.upsert({
    where: { slug: "demo-brokerage" },
    update: {},
    create: {
      name: "Vasundhara Plots & Estates (Demo)",
      slug: "demo-brokerage",
      plan: "pro",
      whatsappMode: "hybrid",
      whatsappConfig: { create: {} },
    },
  });

  // NOTE: authId here is fake — in real flow Supabase creates the auth user first.
  // For seeding purposes we just need a value that won't clash.
  const broker = await prisma.user.upsert({
    where: { authId: "seed-broker-auth-id" },
    update: {},
    create: {
      authId: "seed-broker-auth-id",
      orgId: org.id,
      role: "broker_admin",
      name: "Ravi Kumar",
      email: "ravi@demo.test",
      phone: "+919876543210",
    },
  });

  const plot = await prisma.plot.create({
    data: {
      orgId: org.id,
      title: "2400 sqft corner plot — Whitefield",
      location: "Whitefield Phase 2, Bangalore",
      city: "Bangalore",
      sizeSqft: 2400,
      priceInr: 8500000,
      description: "East-facing corner plot in gated layout, all approvals.",
      photos: [],
    },
  });

  const client = await prisma.user.upsert({
    where: { authId: "seed-client-auth-id" },
    update: {},
    create: {
      authId: "seed-client-auth-id",
      orgId: org.id,
      role: "client",
      name: "Priya Sharma",
      email: "priya@demo.test",
      phone: "+919812345678",
      ownerAgentId: broker.id,
    },
  });

  // Native auth needs an AuthCredential row; without it these users can't log in.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const userId of [broker.id, client.id]) {
    await prisma.authCredential.upsert({
      where: { userId },
      update: { passwordHash },
      create: { userId, passwordHash, emailVerifiedAt: new Date() },
    });
  }

  await prisma.invitation.create({
    data: {
      orgId: org.id,
      sentById: broker.id,
      clientName: "Arjun Mehta",
      clientPhone: "+919900112233",
      token: randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.visit.create({
    data: {
      orgId: org.id,
      plotId: plot.id,
      clientId: client.id,
      agentId: broker.id,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: "Client wants to see east-facing corner.",
    },
  });

  await prisma.analyticsEvent.createMany({
    data: [
      { orgId: org.id, type: "org.created", actorId: broker.id },
      { orgId: org.id, type: "plot.created", actorId: broker.id },
      { orgId: org.id, type: "invitation.sent", actorId: broker.id },
      { orgId: org.id, type: "visit.scheduled", actorId: broker.id },
    ],
  });

  await seedSampleHistory(org.id, broker.id);

  console.log("Done. Org:", org.slug);
}

/** Labelled demo history for AI insights. Safe to re-run: skipped if already there. */
async function seedSampleHistory(orgId: string, brokerId: string) {
  const alreadySeeded = await prisma.plot.findUnique({ where: { id: "sample-plot-0" } });
  if (alreadySeeded) return;

  const agent = await prisma.user.create({
    data: {
      authId: "sample-agent-auth-id",
      orgId,
      role: "broker_agent",
      name: "Neha Verma",
      email: "neha@demo.test",
      phone: "+910000099999",
    },
  });

  const now = new Date();
  const history = buildSampleHistory(orgId, [brokerId, agent.id], now);
  await prisma.organization.update({ where: { id: orgId }, data: { behaviorTrackingEnabled: true } });
  await prisma.plot.createMany({ data: history.plots });
  await prisma.user.createMany({ data: history.clients });
  await prisma.visit.createMany({ data: history.visits });
  await prisma.message.createMany({ data: history.messages });
  await prisma.analyticsEvent.createMany({ data: history.events });
  await prisma.staffActivity.createMany({ data: history.activity });
  await prisma.invitation.createMany({ data: history.invitations });

  const result = await runDailyInsights(orgId, now);
  console.log("Sample history ready:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
