import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { buildDwg } from "@/lib/architect/export-dwg";

export const dynamic = "force-dynamic";

/**
 * GET /api/architect/export/[id]/dwg
 *
 * Today: returns 501 with a JSON payload pointing the caller at the DXF endpoint.
 * Tomorrow: when `lib/architect/export-dwg.ts` has a real encoder registered via
 * `setDwgEncoder()`, this route streams the .dwg bytes back without code change.
 *
 * Why 501 (Not Implemented) and not 404: the resource conceptually exists, we
 * just don't generate it yet. 501 signals "this server doesn't know how to do
 * this *yet*", which is accurate. Clients that handle 501 can fall back to DXF.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const design = await prisma.buildingDesign.findUnique({ where: { id: params.id } });
  if (!design || design.status !== "ready") {
    return NextResponse.json({ error: "Design not ready" }, { status: 404 });
  }
  if (design.orgId) {
    const user = await getSessionUser();
    if (!user || user.orgId !== design.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await buildDwg(design.requirements as any, design.brief as any);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "DWG export is not yet enabled on this deployment.",
        reason: result.reason,
        fallback: {
          format: result.suggestedExport,
          url: result.suggestedHref(design.id),
          note:
            "Every modern CAD tool (AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD) imports DXF cleanly. If you specifically need .dwg, contact your account manager — we license ODA Teigha for enterprise customers on request.",
        },
      },
      { status: 501 }
    );
  }

  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/x-dwg",
      "Content-Disposition": `attachment; filename="design-${design.id.slice(0, 8)}.dwg"`,
      "X-PlotBroker-Format": `AutoCAD ${result.version} DWG`,
    },
  });
}
