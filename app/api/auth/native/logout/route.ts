import { NextRequest, NextResponse } from "next/server";
import { revokeSessionByCookie } from "@/lib/auth/native/session-cookie";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/native/logout
 *
 * Marks the current session revoked and clears the cookie. Idempotent —
 * returns 200 whether or not a session was present.
 */
export async function POST(_req: NextRequest) {
  await revokeSessionByCookie();
  return NextResponse.json({ ok: true });
}
