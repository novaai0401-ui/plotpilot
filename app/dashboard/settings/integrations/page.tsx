import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { describeScopes } from "@/lib/auth/oauth-scopes";
import { IntegrationsList } from "./list";

/**
 * "Authorized apps" — every OAuth app the current user has granted access to,
 * with one-click revoke. Mirrors GitHub's Settings → Authorized OAuth Apps.
 *
 * Scopes are shown with their plain-English labels so a non-developer broker
 * can audit what each app actually does.
 */
export default async function IntegrationsPage() {
  const user = await requireUser(BROKER_ROLES);

  const tokens = await prisma.accessToken.findMany({
    where: { userId: user.id, status: "active", appId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { app: true },
  });

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Authorized apps</h1>
        <p className="text-sm text-gray-600">
          Third-party apps that have access to your PlotBroker account. Revoke
          any time — the app stops working immediately.
        </p>
      </header>

      <IntegrationsList
        tokens={tokens.map((t) => ({
          id: t.id,
          appId: t.appId!,
          appName: t.app?.name ?? "(unknown app)",
          appDescription: t.app?.description ?? null,
          appHomepage: t.app?.homepageUrl ?? null,
          tokenLast4: t.tokenLast4,
          scopes: describeScopes(t.scopes).map((s) => ({ name: s.name, label: s.label, sensitivity: s.sensitivity })),
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          expiresAt: t.expiresAt?.toISOString() ?? null,
        }))}
      />
    </main>
  );
}
