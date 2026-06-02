import { NextRequest, NextResponse } from "next/server";
import { completeMfaChallenge } from "@/lib/auth/native/service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/native/login/mfa
 *
 * Body: { pendingMfaToken, code }
 *
 * Consumes the pending challenge token from /login and a 6-digit TOTP code
 * OR a 10-char recovery code. On success, sets the full session cookie.
 *
 * Per-token rate limit: 5 attempts per pending token. After that the pending
 * token is effectively dead.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const body = await req.json().catch(() => ({}));
  const pendingMfaToken = String(body.pendingMfaToken || "");

  const rl = await checkRateLimit(pendingMfaToken.slice(0, 32), {
    prefix: "auth_login_mfa_token",
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many MFA attempts on this challenge. Sign in again." },
      { status: 429 }
    );
  }

  const result = await completeMfaChallenge({
    pendingMfaToken,
    code: String(body.code || ""),
    ip,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
