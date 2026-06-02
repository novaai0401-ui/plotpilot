import { prisma } from "./prisma";

/**
 * Probe Postgres to check that RLS is enabled on every tenant-scoped table.
 *
 * Why: `prisma/migrations/rls/001_enable_rls.sql` must be applied manually after
 * the first `prisma db push`. If a deployer forgets, the app still works but
 * loses its database-layer tenant-isolation guarantee. This probe surfaces that
 * gap loudly instead of silently.
 *
 * Usage:
 *   - Admin dashboard banner when result.allEnabled === false (production warning)
 *   - CI smoke check via `tsx scripts/check-rls.ts`
 *   - Startup log in production via instrumentation hook
 */

const TENANT_TABLES = [
  "Organization",
  "User",
  "Plot",
  "Invitation",
  "Visit",
  "Message",
  "WhatsAppConfig",
  "AnalyticsEvent",
  "BuildingDesign",
  "Notification",
  "UsageEvent",
];

export type RlsCheckResult = {
  allEnabled: boolean;
  perTable: { table: string; rls: boolean; forced: boolean }[];
  unreachable?: string;
};

/**
 * Queries `pg_class` for `relrowsecurity` (RLS enabled) and `relforcerowsecurity`
 * (FORCE — applies even to table owner). For our setup we only require the
 * first; the service_role intentionally bypasses RLS.
 */
export async function checkRls(): Promise<RlsCheckResult> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { table_name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >(`
      select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = ANY($1::text[])
    `, TENANT_TABLES);

    const found = new Map(rows.map((r) => [r.table_name, r]));
    const perTable = TENANT_TABLES.map((t) => {
      const r = found.get(t);
      return {
        table: t,
        rls: !!r?.relrowsecurity,
        forced: !!r?.relforcerowsecurity,
      };
    });
    const allEnabled = perTable.every((p) => p.rls);
    return { allEnabled, perTable };
  } catch (e: any) {
    return {
      allEnabled: false,
      perTable: [],
      unreachable: e?.message || String(e),
    };
  }
}
