import { prisma } from "./prisma";

/**
 * Run a callback inside a transaction with `app.current_org_id` set, so RLS
 * policies filter every query by tenant. Use this for any code path where you
 * want defense-in-depth on top of the app-layer orgId filter.
 *
 * Example:
 *   const plots = await withOrg(user.orgId, (tx) => tx.plot.findMany());
 *
 * Note: SET LOCAL only affects the current transaction, so escaping the tx
 * resets the GUC automatically. Prisma Accelerate / pgBouncer in transaction
 * mode is supported because SET LOCAL is transaction-scoped.
 */
export async function withOrg<T>(
  orgId: string,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  // Basic guard against injection — orgId is a cuid, but be defensive.
  if (!/^[a-z0-9]+$/i.test(orgId)) throw new Error("invalid orgId");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`);
    return fn(tx);
  });
}
