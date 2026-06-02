import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";

export async function POST() {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
