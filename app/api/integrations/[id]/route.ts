import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/integrations/[id]
 * Authenticated user revokes one of THEIR access tokens (by token id).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const row = await prisma.accessToken.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.accessToken.update({
    where: { id: row.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
