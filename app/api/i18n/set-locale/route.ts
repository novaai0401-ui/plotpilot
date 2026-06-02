import { NextRequest, NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/lib/i18n/dict";

/**
 * POST /api/i18n/set-locale
 *
 * Sets the locale cookie. Body: { locale: "en" | "hi" }
 * Returns 204; client-side caller should reload to apply.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const locale = String(body.locale || "");
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set("plotbroker_locale", locale as Locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  return res;
}
