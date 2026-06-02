import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SUBJECT_VARIANTS } from "@/lib/email/templates";

export default async function EmailExperimentsPage() {
  await requireUser(["super_admin"]);

  // Fetch every public_lead design that has been emailed.
  const rows = await prisma.buildingDesign.findMany({
    where: { source: "public_lead", followupEmailSentAt: { not: null } },
    select: {
      followupEmailVariant: true,
      followupEmailOpenedAt: true,
      followupEmailClickedAt: true,
      claimedAt: true,
    },
  });

  type Bucket = { sent: number; opened: number; clicked: number; converted: number };
  const totals: Record<string, Bucket> = {};
  for (const variant of Object.keys(SUBJECT_VARIANTS)) {
    totals[variant] = { sent: 0, opened: 0, clicked: 0, converted: 0 };
  }
  totals["unknown"] = { sent: 0, opened: 0, clicked: 0, converted: 0 };

  for (const r of rows) {
    const k = r.followupEmailVariant || "unknown";
    if (!totals[k]) totals[k] = { sent: 0, opened: 0, clicked: 0, converted: 0 };
    totals[k].sent++;
    if (r.followupEmailOpenedAt) totals[k].opened++;
    if (r.followupEmailClickedAt) totals[k].clicked++;
    if (r.claimedAt) totals[k].converted++;
  }

  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email subject A/B test</h1>
      <p className="text-sm text-gray-400">
        Variants are picked deterministically by design ID so each lead always gets the same one.
        Open = tracking pixel hit; Click = recipient hit the design link; Converted = lead was
        later claimed by a broker.
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-left text-xs uppercase text-gray-300">
            <tr>
              <th className="p-3">Variant</th>
              <th className="p-3">Subject template</th>
              <th className="p-3 text-right">Sent</th>
              <th className="p-3 text-right">Open rate</th>
              <th className="p-3 text-right">Click rate</th>
              <th className="p-3 text-right">Claim rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(totals)
              .filter(([k, v]) => v.sent > 0 || k in SUBJECT_VARIANTS)
              .map(([k, v]) => {
                const template =
                  (SUBJECT_VARIANTS as any)[k]?.({
                    name: "Anita",
                    projectType: "residential_house",
                    totalSqft: 2400,
                    designUrl: "...",
                    appName: "PlotBroker",
                  }) || "(unknown variant)";
                return (
                  <tr key={k} className="border-t border-gray-700">
                    <td className="p-3 font-mono">{k}</td>
                    <td className="p-3 text-gray-300 text-xs italic">{template}</td>
                    <td className="p-3 text-right">{v.sent}</td>
                    <td className="p-3 text-right">{pct(v.opened, v.sent)} ({v.opened})</td>
                    <td className="p-3 text-right">{pct(v.clicked, v.sent)} ({v.clicked})</td>
                    <td className="p-3 text-right">{pct(v.converted, v.sent)} ({v.converted})</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Note: Apple Mail Privacy Protection + Gmail image proxy inflate open rates and may report
        opens that never happened. Treat click and claim rates as the more reliable signals.
      </p>
    </div>
  );
}
