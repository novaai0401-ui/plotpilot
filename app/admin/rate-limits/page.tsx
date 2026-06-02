import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isProductionRateLimitConfigured } from "@/lib/rate-limit";

/**
 * Super-admin view of rate-limit denials over the last 7 days.
 *
 * Data source: `AnalyticsEvent` rows of type `rate_limit.denied`. These are
 * written by callers of `persistRateLimitDenial()` — anywhere that has an
 * `orgId` in scope when the limit denies. Public-endpoint denials (where we
 * have only an IP) don't show here; they're in Sentry breadcrumbs instead.
 *
 * Useful for spotting:
 *  - One org repeatedly hitting the public-architect cap (likely abuse)
 *  - A specific prefix dominating denials (signal that the cap is too low)
 *  - Sudden spikes (signal that someone's running a script)
 */
export default async function AdminRateLimitsPage() {
  await requireUser(["super_admin"]);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const events = await prisma.analyticsEvent.findMany({
    where: { type: "rate_limit.denied", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: { org: { select: { name: true, slug: true } } },
    take: 500,
  });

  // Aggregate by prefix + by org
  const byPrefix = new Map<string, number>();
  const byOrg = new Map<string, { name: string; count: number }>();
  for (const e of events) {
    const prefix = ((e.metadata as any)?.prefix as string) || "(unknown)";
    byPrefix.set(prefix, (byPrefix.get(prefix) || 0) + 1);
    if (e.orgId) {
      const existing = byOrg.get(e.orgId) || { name: e.org?.name || e.orgId, count: 0 };
      existing.count++;
      byOrg.set(e.orgId, existing);
    }
  }

  const prefixRows = [...byPrefix.entries()].sort((a, b) => b[1] - a[1]);
  const orgRows = [...byOrg.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 20);
  const distributed = isProductionRateLimitConfigured();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rate-limit denials</h1>
          <p className="text-sm text-gray-400">
            Last 7 days, attributed to an org (public-endpoint denials live in Sentry).
          </p>
        </div>
        <div className="text-xs">
          Backend:{" "}
          <span
            className={
              "px-2 py-0.5 rounded font-medium " +
              (distributed ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200")
            }
          >
            {distributed ? "Upstash (distributed)" : "in-memory (single-instance)"}
          </span>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-sm text-gray-400 text-center">
          No org-attributed denials in the last 7 days. (If this seems wrong, public-endpoint
          denials are in <code>Sentry → audit:rate-limit</code> breadcrumbs.)
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3">By prefix</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-2">Prefix</th>
                  <th className="py-2 text-right">Denials</th>
                </tr>
              </thead>
              <tbody>
                {prefixRows.map(([prefix, count]) => (
                  <tr key={prefix} className="border-b border-gray-900">
                    <td className="py-2 font-mono text-xs">{prefix}</td>
                    <td className="py-2 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3">By organization (top 20)</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="py-2">Organization</th>
                  <th className="py-2 text-right">Denials</th>
                </tr>
              </thead>
              <tbody>
                {orgRows.map(([orgId, { name, count }]) => (
                  <tr key={orgId} className="border-b border-gray-900">
                    <td className="py-2 truncate">{name}</td>
                    <td className="py-2 text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-3 text-sm">Recent events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-gray-400 border-b border-gray-800">
              <tr>
                <th className="py-2">When</th>
                <th className="py-2">Prefix</th>
                <th className="py-2">Organization</th>
                <th className="py-2 text-right">Reset</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 50).map((e) => {
                const meta = (e.metadata as any) || {};
                return (
                  <tr key={e.id} className="border-b border-gray-900">
                    <td className="py-2 whitespace-nowrap text-gray-400">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono">{meta.prefix || "(unknown)"}</td>
                    <td className="py-2 truncate">{e.org?.name || "—"}</td>
                    <td className="py-2 text-right text-gray-400">
                      {meta.resetAt ? new Date(meta.resetAt).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
