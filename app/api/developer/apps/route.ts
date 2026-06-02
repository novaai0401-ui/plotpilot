import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { mintClientId, mintClientSecret } from "@/lib/auth/api-token";
import { isValidScope, scopesPermitted } from "@/lib/auth/oauth-scopes";

export const dynamic = "force-dynamic";

/**
 * POST /api/developer/apps
 * broker_admin only.
 *
 * Creates a new OAuthApp. Returns the raw client_secret ONCE in the response
 * — never again. The caller is responsible for storing it before navigating away.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(["broker_admin"]);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const description = body.description ? String(body.description).slice(0, 500) : null;
  const homepageUrl = body.homepageUrl ? String(body.homepageUrl).slice(0, 500) : null;
  const redirectUris: string[] = Array.isArray(body.redirectUris)
    ? body.redirectUris.filter((u: unknown) => typeof u === "string").map((u: string) => u.trim()).filter(Boolean)
    : [];
  const allowedScopes: string[] = Array.isArray(body.allowedScopes)
    ? body.allowedScopes.filter((s: unknown) => typeof s === "string" && isValidScope(s as string))
    : [];

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (redirectUris.length === 0) {
    return NextResponse.json({ error: "At least one redirect URI required" }, { status: 400 });
  }
  if (allowedScopes.length === 0) {
    return NextResponse.json({ error: "At least one scope required" }, { status: 400 });
  }
  // URL parse check
  for (const u of redirectUris) {
    try {
      new URL(u);
    } catch {
      return NextResponse.json({ error: `Invalid redirect_uri: ${u}` }, { status: 400 });
    }
  }

  const clientId = mintClientId();
  const { raw: clientSecret, hash: clientSecretHash } = mintClientSecret();

  const app = await prisma.oAuthApp.create({
    data: {
      orgId: user.orgId,
      name,
      description,
      homepageUrl,
      clientId,
      clientSecretHash,
      redirectUris,
      allowedScopes,
      defaultScopes: allowedScopes,
    },
  });

  return NextResponse.json({
    id: app.id,
    name: app.name,
    clientId: app.clientId,
    // Raw secret returned ONCE.
    clientSecret,
    redirectUris: app.redirectUris,
    allowedScopes: app.allowedScopes,
    createdAt: app.createdAt,
  });
}
