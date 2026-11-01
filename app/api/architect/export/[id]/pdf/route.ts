import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { buildDesignPdf } from "@/lib/architect/export-pdf";
import { localizeBrief, narrativeForLocale } from "@/lib/architect/localize";
import { getLocale } from "@/lib/i18n/server";

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

  const locale = getLocale();
  const saved = {
    requirements: design.requirements as any,
    brief: design.brief as any,
    narrative: design.narrative,
  };
  const pdf = await buildDesignPdf({
    requirements: saved.requirements,
    brief: localizeBrief(saved.brief, locale),
    narrative: narrativeForLocale(saved, locale),
    renderImageUrl: design.renderImageUrl,
    generatedAt: design.createdAt,
    designId: design.id,
    locale,
  });

  // pdf-lib returns Uint8Array — wrap in Buffer so NextResponse.BodyInit accepts it.
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="design-${design.id.slice(0, 8)}.pdf"`,
      // The language comes from a cookie, so a cached copy could be the wrong one.
      "Cache-Control": "private, no-store",
    },
  });
}
