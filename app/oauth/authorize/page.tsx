import { redirect } from "next/navigation";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { describeScopes, isValidScope, scopesPermitted } from "@/lib/auth/oauth-scopes";
import { AuthorizeConsent } from "./consent";

/**
 * OAuth 2.0 authorization endpoint (server-rendered consent screen).
 *
 * URL: /oauth/authorize?client_id=...&redirect_uri=...&scope=plots:read+clients:read&state=opaque
 *
 * Flow:
 *  - User must be signed in (broker_admin/agent only — we don't allow client-
 *    role users to grant API access to third parties).
 *  - We validate client_id, redirect_uri (exact match against app.redirectUris),
 *    and that every requested scope is in app.allowedScopes.
 *  - If anything fails, we redirect back with ?error=... per RFC 6749 §4.1.2.1.
 *  - Otherwise we render the consent screen with the app's name, requested
 *    scopes (in plain English), and Approve/Deny buttons.
 *
 * On Approve the server action mints an AuthorizationCode and redirects to
 * redirect_uri?code=...&state=... The app then POSTs to /api/oauth/token to
 * exchange the code for an AccessToken.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  // Auth gate. Clients can't issue API access; only broker_admin / broker_agent.
  const user = await requireUser(BROKER_ROLES);

  const clientId = pickString(searchParams.client_id);
  const redirectUri = pickString(searchParams.redirect_uri);
  const scopeParam = pickString(searchParams.scope);
  const state = pickString(searchParams.state);
  const responseType = pickString(searchParams.response_type) ?? "code";

  if (!clientId) return <FatalError reason="missing client_id" />;
  if (!redirectUri) return <FatalError reason="missing redirect_uri" />;
  if (responseType !== "code") {
    return errorRedirect(redirectUri, state, "unsupported_response_type", "Only 'code' grant is supported.");
  }

  const app = await prisma.oAuthApp.findUnique({ where: { clientId } });
  if (!app || !app.isActive) {
    // Per RFC, we DON'T redirect when the client_id is unknown — render an error
    // here instead so an attacker can't use the page to forge redirects.
    return <FatalError reason="unknown or inactive client_id" />;
  }
  if (!app.redirectUris.includes(redirectUri)) {
    return <FatalError reason="redirect_uri not whitelisted for this app" />;
  }

  const requestedScopes = (scopeParam || "")
    .split(/[\s,+]+/)
    .filter(Boolean)
    .filter((s) => isValidScope(s));

  if (requestedScopes.length === 0) {
    return errorRedirect(redirectUri, state, "invalid_scope", "At least one valid scope is required.");
  }
  if (!scopesPermitted(requestedScopes, app.allowedScopes)) {
    return errorRedirect(redirectUri, state, "invalid_scope", "App is not configured for one of the requested scopes.");
  }

  return (
    <AuthorizeConsent
      app={{ id: app.id, clientId: app.clientId, name: app.name, description: app.description, homepageUrl: app.homepageUrl, iconUrl: app.iconUrl }}
      user={{ name: user.name, email: user.email }}
      scopes={describeScopes(requestedScopes)}
      redirectUri={redirectUri}
      state={state ?? ""}
    />
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function FatalError({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 space-y-3">
        <h1 className="text-lg font-semibold text-red-800">Authorization request invalid</h1>
        <p className="text-sm text-gray-700">{reason}</p>
        <p className="text-xs text-gray-500">
          If you developed this app, check that <code>client_id</code> and{" "}
          <code>redirect_uri</code> match exactly what you registered at{" "}
          <code>/dashboard/settings/developer</code>.
        </p>
      </div>
    </main>
  );
}

function errorRedirect(redirectUri: string, state: string | undefined, code: string, description: string) {
  // The error redirect is the RFC-defined path. We do it server-side so the
  // user doesn't see our internal page when the failure is the app's fault.
  const u = new URL(redirectUri);
  u.searchParams.set("error", code);
  u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  redirect(u.toString());
}
