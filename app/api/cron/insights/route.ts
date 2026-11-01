import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pruneStaffActivity, runDailyInsights } from "@/lib/insights/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron: retrains each org's lead model, refreshes suggestions, and writes
 * any weekly / monthly / yearly report that has come due.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Fails closed: if the secret isn't
 * configured, nothing runs. One org failing doesn't stop the others.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let succeeded = 0;
  const failures: string[] = [];

  for (const org of orgs) {
    try {
      await runDailyInsights(org.id, now);
      succeeded++;
    } catch (e) {
      console.error(`[cron/insights] org ${org.id} failed:`, e);
      failures.push(org.id);
    }
  }
  await pruneStaffActivity(now);

  return NextResponse.json({ ok: failures.length === 0, orgs: orgs.length, succeeded, failures });
}
