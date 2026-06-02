#!/usr/bin/env node
/**
 * CLI: `npx tsx scripts/check-rls.ts`
 *
 * Exits 0 if RLS is enabled on every tenant table, 1 otherwise. Wire into CI
 * post-deploy to catch missing migrations.
 */
import { checkRls } from "../lib/db/rls-check";

(async () => {
  const r = await checkRls();
  if (r.unreachable) {
    console.error("[rls-check] cannot reach database:", r.unreachable);
    process.exit(1);
  }
  console.log("table".padEnd(20), "RLS", "FORCE");
  for (const t of r.perTable) {
    const status = t.rls ? "\x1b[32m✓\x1b[0m  " : "\x1b[31m✗\x1b[0m  ";
    const forced = t.forced ? " ✓" : " —";
    console.log(t.table.padEnd(20), status, forced);
  }
  if (!r.allEnabled) {
    console.error(
      "\n\x1b[31m✗ RLS not fully enabled.\x1b[0m Apply the migration:\n  psql $DATABASE_URL -f prisma/migrations/rls/001_enable_rls.sql"
    );
    process.exit(1);
  }
  console.log("\n\x1b[32m✓ RLS enabled on every tenant table.\x1b[0m");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
