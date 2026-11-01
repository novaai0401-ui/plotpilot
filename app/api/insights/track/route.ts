import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeDashboardPath } from "@/lib/insights/normalize-path";

export const dynamic = "force-dynamic";

/**
 * POST /api/insights/track
 * Body: { path: string }
 *
 * Records one dashboard section view, only for broker staff, and only when the
 * org has turned tracking on. Always answers 204 so a tracking problem can
 * never surface in the UI.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const user = await getSessionUser();
  if (!user || !BROKER_ROLES.includes(user.role)) return done;

  const body = await req.json().catch(() => ({}));
  const path = normalizeDashboardPath(body.path);
  if (!path) return done;

  const rl = await checkRateLimit(user.id, {
    prefix: "insights_track_user",
    max: 300,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) return done;

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { behaviorTrackingEnabled: true },
  });
  if (org?.behaviorTrackingEnabled) {
    await prisma.staffActivity.create({ data: { orgId: user.orgId, userId: user.id, path } });
  }
  return done;
}
