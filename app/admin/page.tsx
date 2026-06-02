import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { checkRls } from "@/lib/db/rls-check";

export default async function SuperAdminOverview() {
  await requireUser(["super_admin"]);

  const [orgs, users, clients, plots, visits, messages, rls] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.user.count({ where: { role: "client" } }),
    prisma.plot.count(),
    prisma.visit.count(),
    prisma.message.count(),
    checkRls(),
  ]);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSignups = await prisma.organization.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const cards = [
    { label: "Organizations", value: orgs },
    { label: "Users (all)", value: users },
    { label: "Clients", value: clients },
    { label: "Plots", value: plots },
    { label: "Visits", value: visits },
    { label: "Messages", value: messages },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform overview</h1>

      {!rls.allEnabled && (
        <div className="bg-red-950/50 border-2 border-red-700 rounded-lg p-4 text-sm">
          <div className="font-bold text-red-300 flex items-center gap-2">
            ⚠ Row-Level Security is not fully enabled
          </div>
          <p className="text-red-200/80 mt-1 text-xs">
            Tenant isolation currently depends only on app-layer <code>orgId</code> filters. A bug or
            forgotten <code>where</code> clause could leak data across organizations. Apply the migration now:
          </p>
          <pre className="mt-2 text-xs bg-black/40 p-2 rounded overflow-x-auto">
            psql $DATABASE_URL -f prisma/migrations/rls/001_enable_rls.sql
          </pre>
          {rls.perTable.length > 0 && (
            <details className="mt-2 text-xs text-red-200/70">
              <summary className="cursor-pointer">Per-table status</summary>
              <ul className="mt-1 ml-4">
                {rls.perTable.map((t) => (
                  <li key={t.table}>
                    {t.rls ? "✓" : "✗"} {t.table}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {rls.unreachable && (
            <div className="mt-2 text-xs text-red-200/70">Cannot reach DB: {rls.unreachable}</div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs uppercase text-gray-400">{c.label}</div>
            <div className="text-3xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-semibold mb-2">New organizations (last 7 days)</h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
          {recentSignups.length === 0 && (
            <div className="p-4 text-sm text-gray-400">None.</div>
          )}
          {recentSignups.map((o) => (
            <div key={o.id} className="p-3 text-sm flex justify-between">
              <span>
                <strong>{o.name}</strong>{" "}
                <span className="text-gray-400">({o.slug})</span>
              </span>
              <span className="text-gray-400">
                {o.plan} · {new Date(o.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
