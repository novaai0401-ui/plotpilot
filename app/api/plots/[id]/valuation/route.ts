import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateValuation } from "@/lib/matching/valuation";

export const dynamic = "force-dynamic";

/**
 * GET /api/plots/[id]/valuation
 *
 * Returns Claude's fair-market valuation for the plot: a single estimate
 * with low/high band, confidence level, per-sqft rate, premium and discount
 * factors, and a 2-3 sentence narrative.
 *
 * Cached per plot signature (location + city + size + description + status)
 * — same plot rows don't burn LLM tokens twice in a warm process.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser(BROKER_ROLES);
  const plot = await prisma.plot.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!plot) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }

  const valuation = await generateValuation({
    orgId: user.orgId,
    plot: {
      title: plot.title,
      location: plot.location,
      city: plot.city,
      lat: plot.lat,
      lng: plot.lng,
      sizeSqft: plot.sizeSqft,
      priceInr: plot.priceInr,
      description: plot.description,
      status: plot.status,
    },
  });

  return NextResponse.json({
    askingInr: plot.priceInr,
    valuation,
  });
}
