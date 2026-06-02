import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generatePitch } from "@/lib/matching/pitch";
import { parseClientPreferences } from "@/lib/matching/preferences";
import { buildWaMeUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * POST /api/plots/[id]/pitch
 * Body: { clientId: string, brokerNote?: string }
 *
 * Returns an LLM-generated personalized WhatsApp message tailored to this
 * specific (plot, client) pair, plus a wa.me deep-link the broker can hit
 * to open WhatsApp with the message pre-filled.
 *
 * Cost control: caches per (plot signature, client name, preferences). Cold
 * starts re-pay the LLM but warm processes serve repeats for free.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser(BROKER_ROLES);
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  const brokerNote = body.brokerNote ? String(body.brokerNote).slice(0, 500) : undefined;

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const [plot, client] = await Promise.all([
    prisma.plot.findFirst({ where: { id: params.id, orgId: user.orgId } }),
    prisma.user.findFirst({
      where: { id: clientId, orgId: user.orgId, role: "client" },
    }),
  ]);

  if (!plot) return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await generatePitch({
    orgId: user.orgId,
    plot: {
      title: plot.title,
      location: plot.location,
      city: plot.city,
      sizeSqft: plot.sizeSqft,
      priceInr: plot.priceInr,
      description: plot.description,
    },
    broker: { name: user.name },
    client: { name: client.name },
    preferences: parseClientPreferences(client.preferences),
    brokerNote,
  });

  return NextResponse.json({
    text: result.text,
    cacheHit: result.cacheHit,
    isFallback: result.isFallback,
    fallbackReason: result.fallbackReason,
    waMeUrl: buildWaMeUrl(client.phone, result.text),
  });
}
