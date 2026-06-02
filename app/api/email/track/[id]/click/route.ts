import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Click tracking redirect. Updates followupEmailClickedAt then 302s to `to`.
 * Validates that `to` is on the same origin to prevent open-redirect abuse.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const to = req.nextUrl.searchParams.get("to") || "/";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  // Open-redirect guard: only allow same-host destinations
  let safeTo = "/";
  try {
    const target = new URL(to, appUrl);
    const allowed = new URL(appUrl);
    if (target.host === allowed.host) safeTo = target.toString();
  } catch {
    safeTo = "/";
  }

  // Mark click (also implies open if the pixel was blocked)
  // Plus: record the hour-of-day on the lead's User row for send-time optimization
  //       (only if the design's lead matches a User — currently public leads have no User
  //        row until claimed, so the hour signal lives on the broker side for in-org messages).
  const nowHour = new Date().getUTCHours();
  prisma.buildingDesign
    .updateMany({
      where: { id: params.id, followupEmailClickedAt: null },
      data: {
        followupEmailClickedAt: new Date(),
        followupEmailOpenedAt: new Date(),
      },
    })
    .catch((e) => console.warn("[email-track] click update failed:", e?.message));

  // If this design has been claimed, update the claiming broker's bestSendHourUtc
  // using an exponentially-smoothed running estimate. (Broker reading the lead-alert
  // email is a strong signal for when they're online.)
  prisma.buildingDesign
    .findUnique({ where: { id: params.id }, select: { claimedByAgentId: true } })
    .then(async (d) => {
      if (!d?.claimedByAgentId) return;
      const u = await prisma.user.findUnique({
        where: { id: d.claimedByAgentId },
        select: { bestSendHourUtc: true },
      });
      // Simple update: if no signal yet, use current hour; else move halfway toward it
      const newHour =
        u?.bestSendHourUtc == null
          ? nowHour
          : Math.round((u.bestSendHourUtc + nowHour) / 2) % 24;
      await prisma.user.update({
        where: { id: d.claimedByAgentId },
        data: { bestSendHourUtc: newHour },
      });
    })
    .catch(() => {});

  return NextResponse.redirect(safeTo, 302);
}
