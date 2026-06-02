import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { scoreMatches } from "@/lib/matching/score";
import { parseClientPreferences, summarizePreferences } from "@/lib/matching/preferences";

export const dynamic = "force-dynamic";

/**
 * GET /api/plots/[id]/matches
 *
 * Match Radar — returns every client in the broker's org scored against
 * the plot, sorted by fit, with the score breakdown the UI uses to show
 * *why* each client matched.
 *
 * No AI here — pure deterministic scoring (see lib/matching/score.ts).
 * The AI step is on-demand per match via /api/plots/[id]/pitch.
 *
 * Visibility floor: clients ruled out by the budget cap (>2× over) are
 * dropped unless `?includeRuledOut=1` is passed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser(BROKER_ROLES);

  const plot = await prisma.plot.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!plot) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }

  const clients = await prisma.user.findMany({
    where: { orgId: user.orgId, role: "client" },
    select: { id: true, name: true, preferences: true, phone: true },
  });

  const inputs = clients.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    preferences: parseClientPreferences(c.preferences),
  }));

  const results = scoreMatches(plot, inputs);
  const phoneById = new Map(clients.map((c) => [c.id, c.phone]));

  const includeRuledOut = req.nextUrl.searchParams.get("includeRuledOut") === "1";
  const visible = includeRuledOut ? results : results.filter((r) => !r.ruledOut);

  return NextResponse.json({
    plot: {
      id: plot.id,
      title: plot.title,
      location: plot.location,
      sizeSqft: plot.sizeSqft,
      priceInr: plot.priceInr,
    },
    matches: visible.map((r) => ({
      ...r,
      phone: phoneById.get(r.clientId) || null,
      preferencesSummary: summarizePreferences(
        parseClientPreferences(clients.find((c) => c.id === r.clientId)?.preferences)
      ),
    })),
    totalScored: results.length,
    ruledOutCount: results.filter((r) => r.ruledOut).length,
  });
}
