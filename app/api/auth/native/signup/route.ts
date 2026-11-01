import { NextRequest, NextResponse } from "next/server";
import { signup } from "@/lib/auth/native/service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/native/signup
 *
 * Body: { email, password, name, phone, orgName?, inviteToken?, teamToken? }
 *
 * Rate limit: 5 signups per IP per hour. Prevents drive-by org spam.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await checkRateLimit(ip, {
    prefix: "auth_signup_ip",
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: t("public.err.tooManySignups", { time: formatDateTime(rl.resetAt, getLocale()) }) },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userAgent = req.headers.get("user-agent") || undefined;
  const result = await signup({
    email: String(body.email || ""),
    password: String(body.password || ""),
    name: String(body.name || ""),
    phone: String(body.phone || ""),
    orgName: body.orgName ? String(body.orgName) : undefined,
    inviteToken: body.inviteToken ? String(body.inviteToken) : undefined,
    teamToken: body.teamToken ? String(body.teamToken) : undefined,
    ip,
    userAgent,
  });

  if (!result.ok) {
    return NextResponse.json({ error: t(result.errorKey, result.errorVars) }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    userId: result.userId,
    orgId: result.orgId,
    role: result.role,
    // We DON'T return the verification token to the client. It went out via email.
  });
}
