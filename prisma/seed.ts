import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  const org = await prisma.organization.upsert({
    where: { slug: "demo-brokerage" },
    update: {},
    create: {
      name: "Demo Brokerage",
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

  console.log("Done. Org:", org.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
