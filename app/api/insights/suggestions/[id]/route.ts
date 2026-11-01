import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/insights/suggestions/[id]
 * Body: { decision: "accepted" | "dismissed" }
 *
 * Each decision is feedback: it changes how this kind of suggestion ranks for
 * the org the next time suggestions refresh.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const body = await req.json().catch(() => ({}));
  if (body.decision !== "accepted" && body.decision !== "dismissed") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const { count } = await prisma.insightSuggestion.updateMany({
    where: { id: params.id, orgId: user.orgId, status: "open" },
    data: { status: body.decision, decidedById: user.id, decidedAt: new Date() },
  });
  if (!count) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
