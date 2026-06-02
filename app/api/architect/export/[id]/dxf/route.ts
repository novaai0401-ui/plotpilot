import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { buildDxf } from "@/lib/architect/export-dxf";

export const dynamic = "force-dynamic";

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

  const dxf = buildDxf(design.requirements as any, design.brief as any);

  return new NextResponse(dxf, {
    headers: {
      // Some tools expect `image/vnd.dxf`; AutoCAD also accepts `application/dxf`.
      "Content-Type": "application/dxf",
      "Content-Disposition": `attachment; filename="design-${design.id.slice(0, 8)}.dxf"`,
      // Power-user note in the response headers — visible in `curl -I`.
      "X-PlotBroker-Format": "AutoCAD R12 (AC1009) DXF, units=feet",
      "X-PlotBroker-Opens-In": "AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD",
      "X-PlotBroker-Note": "DXF is Autodesk's open interchange format. This is NOT a .dwg file; .dwg requires AutoCAD or a licensed ODA SDK to write.",
    },
  });
}
