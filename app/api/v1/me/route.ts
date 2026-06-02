import { NextRequest, NextResponse } from "next/server";
import { resolveBearer } from "@/lib/auth/api-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — token introspection.
 *
 * Resolves the Bearer token and returns the authenticated user + the app
 * that issued the token + the granted scopes. Always-on for any valid token;
 * no specific scope required (developers need a way to verify their auth
 * is working without claiming a real permission).
 */
export async function GET(req: NextRequest) {
  const principal = await resolveBearer(req);
  if (!principal) {
    return NextResponse.json(
      { error: "Bearer token missing, invalid, or revoked." },
      { status: 401 }
    );
  }
  return NextResponse.json({
    user: {
      id: principal.user.id,
      name: principal.user.name,
      email: principal.user.email,
      phone: principal.user.phone,
      role: principal.user.role,
      orgId: principal.user.orgId,
    },
    grantedBy: principal.appId
      ? { kind: "oauth_app", appId: principal.appId, appName: principal.appName }
      : { kind: "personal_access_token" },
    scopes: principal.scopes,
    tokenId: principal.tokenId,
  });
}
