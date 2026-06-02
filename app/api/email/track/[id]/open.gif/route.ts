import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// 1×1 transparent GIF (smallest possible) — 43 bytes
const TRANSPARENT_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

/**
 * Email open tracking pixel. Hit when the recipient's mail client renders the email.
 * Idempotent: only sets followupEmailOpenedAt on first hit.
 *
 * Note: many clients (Gmail web, Apple Mail with privacy) proxy or block images,
 * so open rates are a lower bound. Click rate (next route) is more reliable.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // Best-effort update — never block the image response on DB
  prisma.buildingDesign
    .updateMany({
      where: { id: params.id, followupEmailOpenedAt: null },
      data: { followupEmailOpenedAt: new Date() },
    })
    .catch((e) => console.warn("[email-track] open update failed:", e?.message));

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
