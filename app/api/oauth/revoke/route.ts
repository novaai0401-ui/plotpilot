import { NextRequest, NextResponse } from "next/server";
import { hashToken } from "@/lib/auth/api-token";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/revoke  (RFC 7009)
 * Body: { token } (form or JSON)
 *
 * Marks the matching AccessToken row as revoked. Always returns 200 per RFC
 * — we don't disclose whether the token was valid to begin with.
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  let token = "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    token = new URLSearchParams(text).get("token") || "";
  } else {
    const j = await req.json().catch(() => ({}));
    token = String(j.token || "");
  }

  if (token) {
    await prisma.accessToken
      .updateMany({
        where: { tokenHash: hashToken(token), status: "active" },
        data: { status: "revoked", revokedAt: new Date() },
      })
      .catch(() => {});
  }
  // Always 200 per RFC 7009 §2.2 — don't leak whether the token was valid.
  return NextResponse.json({}, { status: 200 });
}
