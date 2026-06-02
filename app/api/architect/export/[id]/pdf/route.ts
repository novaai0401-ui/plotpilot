import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { buildDesignPdf } from "@/lib/architect/export-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const design = await prisma.buildingDesign.findUnique({ where: { id: params.id } });
  if (!design || design.status !== "ready") {
    return NextResponse.json({ error: "Design not ready" }, { status: 404 });
  }
  // Access: org-scoped designs require same-org session; public_lead designs are sharable by id.
  if (design.orgId) {
    const user = await getSessionUser();
    if (!user || user.orgId !== design.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const pdf = await buildDesignPdf({
    requirements: design.requirements as any,
    brief: design.brief as any,
    narrative: design.narrative,
    floorPlansSvg: (design.floorPlansSvg as any) || [],
    renderImageUrl: design.renderImageUrl,
    generatedAt: design.createdAt,
    designId: design.id,
  });

  // pdf-lib returns Uint8Array — wrap in Buffer so NextResponse.BodyInit accepts it.
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="design-${design.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
