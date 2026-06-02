import { NextRequest, NextResponse } from "next/server";
import { THEME_COOKIE, isValidTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * POST /api/theme  { mode: "light" | "dark" | "auto" }
 *
 * Persists the user's theme preference as a cookie. We use a cookie (not
 * Prisma) so signed-out visitors can still toggle without an account, and
 * so the next server render can read it before the React tree hydrates —
 * preventing flash-of-wrong-theme.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode || "");
  if (!isValidTheme(mode)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, mode });
  res.cookies.set(THEME_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    // No HttpOnly — the client toggle reads it to highlight the active option.
  });
  return res;
}
