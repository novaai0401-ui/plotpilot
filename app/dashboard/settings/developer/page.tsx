import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SCOPES } from "@/lib/auth/oauth-scopes";
import { DeveloperDashboard } from "./dashboard";

/**
 * Developer dashboard — manage OAuth apps registered by this org.
 * broker_admin only.
 *
 * Surfaces:
 *  - List of apps with metadata + revoke
 *  - Create flow (client_secret shown ONCE inline with copy button)
 */
export default async function DeveloperPage() {
  const user = await requireUser(["broker_admin"]);
  const apps = await prisma.oAuthApp.findMany({
    where: { orgId: user.orgId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      clientId: true,
      redirectUris: true,
      allowedScopes: true,
      createdAt: true,
      _count: { select: { tokens: true } },
    },
  });

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Developer · OAuth apps</h1>
        <p className="text-sm text-gray-600">
          Register third-party apps that need scoped access to your PlotBroker
          data. Apps go through an explicit consent screen before they can call
          the API on your behalf. Inspired by Zerodha Kite Connect.
        </p>
      </header>

      <DeveloperDashboard
        initialApps={apps.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          clientId: a.clientId,
          redirectUris: a.redirectUris,
          allowedScopes: a.allowedScopes,
          createdAt: a.createdAt.toISOString(),
          activeTokens: a._count.tokens,
        }))}
        scopeCatalog={SCOPES.map((s) => ({ name: s.name, label: s.label, sensitivity: s.sensitivity }))}
      />

      <section className="text-xs text-gray-500 border-t pt-4 space-y-1">
        <p>
          <strong>Quickstart for developers:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Register an app above with one or more <code>redirect_uri</code>s.</li>
          <li>
            Send the user to{" "}
            <code>/oauth/authorize?client_id=&lt;clientId&gt;&redirect_uri=…&scope=plots:read&state=…</code>
          </li>
          <li>
            Exchange the <code>?code=…</code> at the redirect for an access token via POST{" "}
            <code>/api/oauth/token</code>.
          </li>
          <li>
            Call <code>/api/v1/me</code>, <code>/api/v1/plots</code>, etc. with{" "}
            <code>Authorization: Bearer &lt;token&gt;</code>.
          </li>
        </ol>
      </section>
    </main>
  );
}
