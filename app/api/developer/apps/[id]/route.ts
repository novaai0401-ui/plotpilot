import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/developer/apps/[id]
 * broker_admin only. Soft-delete by marking inactive AND revoking every
 * outstanding access token from this app.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(["broker_admin"]);
  const app = await prisma.oAuthApp.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.oAuthApp.update({
      where: { id: app.id },
      data: { isActive: false },
    }),
    prisma.accessToken.updateMany({
      where: { appId: app.id, status: "active" },
      data: { status: "revoked", revokedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
