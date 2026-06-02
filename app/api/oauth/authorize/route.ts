import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isValidScope, scopesPermitted } from "@/lib/auth/oauth-scopes";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/authorize
 * Body: { appId, action: "approve" | "deny", scopes, redirectUri, state }
 *
 * Called from the consent screen. On approve, mints an AuthorizationCode
 * row (10-min TTL, sha256-hashed) and returns the redirect URL the consent
 * page should navigate to. On deny, returns the RFC error redirect.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(BROKER_ROLES);
  const body = await req.json().catch(() => ({}));
  const appId = String(body.appId || "");
  const action = body.action === "deny" ? "deny" : "approve";
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string" && isValidScope(s as string)) : [];
  const redirectUri = String(body.redirectUri || "");
  const state = typeof body.state === "string" ? body.state : "";

  if (!appId || !redirectUri) {
    return NextResponse.json({ error: "Missing appId or redirectUri" }, { status: 400 });
  }

  const app = await prisma.oAuthApp.findUnique({ where: { id: appId } });
  if (!app || !app.isActive) {
    return NextResponse.json({ error: "Unknown or inactive app" }, { status: 400 });
  }
  if (!app.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "redirect_uri not whitelisted" }, { status: 400 });
  }

  if (action === "deny") {
    const u = new URL(redirectUri);
    u.searchParams.set("error", "access_denied");
    u.searchParams.set("error_description", "The user denied the authorization request.");
    if (state) u.searchParams.set("state", state);
    return NextResponse.json({ location: u.toString() });
  }

  // Validate scopes again at decision time — defense in depth.
  if (scopes.length === 0 || !scopesPermitted(scopes, app.allowedScopes)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  // Mint the authorization code. Raw is returned in the redirect; only the
  // sha256 lands in DB. 10-minute TTL per RFC 6749 §4.1.2.
  const rawCode = `pbc_${base32(randomBytes(32))}`;
  const codeHash = createHash("sha256").update(rawCode).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.authorizationCode.create({
    data: {
      codeHash,
      appId: app.id,
      userId: user.id,
      scopes,
      redirectUri,
      expiresAt,
    },
  });

  const u = new URL(redirectUri);
  u.searchParams.set("code", rawCode);
  if (state) u.searchParams.set("state", state);
  return NextResponse.json({ location: u.toString() });
}

function base32(buf: Buffer): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
