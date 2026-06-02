import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/auth/native/service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/native/login
 *
 * Body: { email, password }
 *
 * On success without MFA: session cookie is set, returns { ok: true, mfaRequired: false }.
 * On success with MFA: pending challenge token is returned in the body
 * (NOT a cookie), client passes it to /api/auth/native/login/mfa with the code.
 *
 * Rate limit: 10 attempts per IP per 15 minutes. The per-credential lockout
 * inside the service is the second layer.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await checkRateLimit(ip, {
    prefix: "auth_login_ip",
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again after ${new Date(rl.resetAt).toLocaleTimeString()}.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userAgent = req.headers.get("user-agent") || undefined;

  const result = await login({
    email: String(body.email || ""),
    password: String(body.password || ""),
    ip,
    userAgent,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.mfaRequired) {
    return NextResponse.json({
      ok: true,
      mfaRequired: true,
      pendingMfaToken: result.pendingMfaToken,
    });
  }
  return NextResponse.json({ ok: true, mfaRequired: false });
}
