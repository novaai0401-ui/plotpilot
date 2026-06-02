import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { mintRawToken, verifyClientSecret } from "@/lib/auth/api-token";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/token
 *
 * RFC 6749 §4.1.3 — Authorization Code Grant token exchange.
 *
 * Accepts both standard form-encoded body and JSON for convenience. Required:
 *   grant_type=authorization_code
 *   code=<the code from /oauth/authorize callback>
 *   client_id=<app.clientId>
 *   client_secret=<the raw secret from app creation>
 *   redirect_uri=<must match the value used at /oauth/authorize>
 *
 * On success returns:
 *   { access_token, token_type: "Bearer", expires_in, scope, token_id }
 *
 * The authorization code is single-use; subsequent exchanges with the same
 * code fail with invalid_grant (and we mark any access tokens minted from
 * a duplicate exchange as revoked — RFC 6749 §4.1.2 recommended behavior).
 */
export async function POST(req: NextRequest) {
  const body = await readBody(req);
  const grantType = body.grant_type;
  const code = body.code;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;
  const redirectUri = body.redirect_uri;

  if (grantType !== "authorization_code") {
    return errResp(400, "unsupported_grant_type", "Only authorization_code is supported.");
  }
  if (!code || !clientId || !clientSecret || !redirectUri) {
    return errResp(400, "invalid_request", "Missing one of: code, client_id, client_secret, redirect_uri.");
  }

  const app = await prisma.oAuthApp.findUnique({ where: { clientId } });
  if (!app || !app.isActive) {
    return errResp(401, "invalid_client", "Unknown or inactive client_id.");
  }
  if (!verifyClientSecret(clientSecret, app.clientSecretHash)) {
    return errResp(401, "invalid_client", "client_secret mismatch.");
  }

  const codeHash = createHash("sha256").update(code).digest("hex");
  const codeRow = await prisma.authorizationCode.findUnique({ where: { codeHash } });
  if (!codeRow) {
    return errResp(400, "invalid_grant", "Authorization code not found.");
  }
  if (codeRow.appId !== app.id) {
    return errResp(400, "invalid_grant", "Code was issued for a different app.");
  }
  if (codeRow.redirectUri !== redirectUri) {
    return errResp(400, "invalid_grant", "redirect_uri does not match the original authorization request.");
  }
  if (codeRow.status !== "pending" || codeRow.expiresAt < new Date()) {
    // If the code was already consumed, revoke all tokens issued from it.
    // RFC 6749 §4.1.2 recommendation.
    if (codeRow.status === "consumed") {
      await prisma.accessToken
        .updateMany({
          where: { appId: app.id, userId: codeRow.userId },
          data: { status: "revoked", revokedAt: new Date() },
        })
        .catch(() => {});
    }
    return errResp(400, "invalid_grant", "Authorization code is expired or already used.");
  }

  // Mint the access token.
  const minted = mintRawToken();
  const expiresInDays = 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const expiresIn = expiresInDays * 24 * 60 * 60;

  const [token] = await prisma.$transaction([
    prisma.accessToken.create({
      data: {
        tokenHash: minted.tokenHash,
        tokenLast4: minted.tokenLast4,
        appId: app.id,
        userId: codeRow.userId,
        scopes: codeRow.scopes,
        expiresAt,
      },
    }),
    prisma.authorizationCode.update({
      where: { id: codeRow.id },
      data: { status: "consumed", consumedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    access_token: minted.rawToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: codeRow.scopes.join(" "),
    token_id: token.id,
  });
}

async function readBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    return Object.fromEntries(
      Object.entries(j).map(([k, v]) => [k, String(v ?? "")])
    );
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  // Try JSON fallback so well-behaved clients still work even if they sent the wrong content-type.
  try {
    const j = await req.json();
    return Object.fromEntries(
      Object.entries(j).map(([k, v]) => [k, String(v ?? "")])
    );
  } catch {
    return {};
  }
}

function errResp(status: number, error: string, error_description: string) {
  return NextResponse.json({ error, error_description }, { status });
}
