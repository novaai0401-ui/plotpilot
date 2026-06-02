import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendAndLogWhatsApp } from "@/lib/whatsapp/send-and-log";

export async function POST(req: NextRequest) {
  const user = await requireUser(BROKER_ROLES);
  const { recipientId, body, visitId, preference } = await req.json();
  if (!recipientId || !body) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  // Authorization: recipient must be in same org
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, orgId: user.orgId },
  });
  if (!recipient) {
    return NextResponse.json({ ok: false, error: "Recipient not found" }, { status: 404 });
  }

  const result = await sendAndLogWhatsApp({
    orgId: user.orgId,
    senderId: user.id,
    recipientId: recipient.id,
    recipientPhone: recipient.phone,
    body,
    visitId,
    preference,
  });

  return NextResponse.json(result);
}
