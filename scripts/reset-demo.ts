import { PrismaClient } from "@prisma/client";

/**
 * Remove the demo workspace so `npm run db:seed` can rebuild it. Touches only
 * the org with slug `demo-brokerage`; every other org is left alone.
 *
 * Deletes in dependency order, because a client's visits and messages block
 * the plain org cascade.
 */

const DEMO_SLUG = "demo-brokerage";
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: DEMO_SLUG } });
  if (!org) {
    console.log("No demo workspace found.");
    return;
  }
  const orgId = org.id;
  const before = await prisma.organization.count();

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { orgId } }),
    prisma.visit.deleteMany({ where: { orgId } }),
    prisma.invitation.deleteMany({ where: { orgId } }),
    prisma.user.updateMany({ where: { orgId }, data: { ownerAgentId: null } }),
    prisma.user.deleteMany({ where: { orgId } }),
    prisma.organization.delete({ where: { id: orgId } }),
  ]);

  console.log(`Demo workspace removed. Organizations: ${before} -> ${await prisma.organization.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
