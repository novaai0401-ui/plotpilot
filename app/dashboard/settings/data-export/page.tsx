import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EXPORTERS, EXPORT_LABELS, type ExportTable } from "@/lib/data-export/exporters";

export default async function DataExportPage() {
  const user = await requireUser(["broker_admin", "super_admin"]);

  // Show row counts so the broker knows what they're about to download
  const [clients, plots, visits, invitations, messages, designs, usage] = await Promise.all([
    prisma.user.count({ where: { orgId: user.orgId, role: "client" } }),
    prisma.plot.count({ where: { orgId: user.orgId } }),
    prisma.visit.count({ where: { orgId: user.orgId } }),
    prisma.invitation.count({ where: { orgId: user.orgId } }),
    prisma.message.count({ where: { orgId: user.orgId } }),
    prisma.buildingDesign.count({ where: { orgId: user.orgId } }),
    prisma.usageEvent.count({ where: { orgId: user.orgId } }),
  ]);
  const counts: Record<ExportTable, number> = {
    clients,
    plots,
    visits,
    invitations,
    messages,
    designs,
    usage,
  };

  const previousExports = await prisma.analyticsEvent.findMany({
    where: { orgId: user.orgId, type: "data.exported" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:underline">
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-bold mt-1">Data export</h1>
        <p className="text-gray-500 text-sm mt-1">
          Download your organization's data as CSV. Useful for backups, accounting reconciliation,
          migration to another system, or fulfilling a DPDP/GDPR data subject access request.
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm space-y-2">
        <div className="font-semibold text-blue-900">Privacy & ownership</div>
        <ul className="list-disc pl-5 text-blue-900/80 space-y-1">
          <li>Exports are <strong>org-scoped</strong> — you'll never see another brokerage's data.</li>
          <li>Files are <strong>UTF-8 with a BOM</strong> so Excel opens them correctly on first try.</li>
          <li>Cells starting with <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code> get a leading quote to prevent formula injection.</li>
          <li>Every download is logged in your <strong>org analytics</strong> with timestamp + actor.</li>
        </ul>
      </div>

      <section>
        <h2 className="font-semibold text-sm mb-2">Available exports</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">Table</th>
                <th className="p-3 text-right">Rows</th>
                <th className="p-3 text-left">Includes</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(EXPORTERS) as ExportTable[]).map((t) => (
                <tr key={t} className="border-t">
                  <td className="p-3 font-medium">{EXPORT_LABELS[t]}</td>
                  <td className="p-3 text-right">{counts[t].toLocaleString()}</td>
                  <td className="p-3 text-gray-500 text-xs">{describe(t)}</td>
                  <td className="p-3 text-right">
                    {counts[t] > 0 ? (
                      <a
                        href={`/api/data-export/${t}`}
                        className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50 inline-block"
                      >
                        ⬇ CSV
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">no data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previousExports.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm mb-2">Recent export activity</h2>
          <div className="bg-white border rounded-lg divide-y">
            {previousExports.map((e) => {
              const meta = (e.metadata as any) || {};
              return (
                <div key={e.id} className="p-3 text-xs flex justify-between text-gray-600">
                  <span>
                    📥 <strong>{meta.table}</strong> exported{" "}
                    {meta.sizeBytes ? `(${formatBytes(meta.sizeBytes)})` : ""}
                  </span>
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function describe(t: ExportTable): string {
  return (
    {
      clients: "name, phone, email, owner agent, signup date",
      plots: "title, location, lat/lng, size, price, status, photo count, description",
      visits: "scheduled at, status, client + plot + agent, rating, notes, feedback",
      invitations: "client contact, status, sent by, expiry, accepted-at",
      messages: "channel, status, sender, recipient, body (last 10k)",
      designs: "type, plot, sqft, floors, lead info, cache hits, claim status",
      usage: "service kind, units, cost (last 10k events)",
    } as Record<ExportTable, string>
  )[t];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
