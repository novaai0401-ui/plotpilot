import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatInr } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import { CopilotPanel } from "@/components/plot/copilot-panel";

export default async function PlotDetail({ params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const plot = await prisma.plot.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { visits: { include: { client: true }, orderBy: { scheduledAt: "desc" } } },
  });
  if (!plot) notFound();
  const locale = getLocale();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/plots" className="text-sm text-gray-500 hover:underline">
        {t("broker.plots.back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{plot.title}</h1>
        <div className="text-gray-500">{plot.location}</div>
      </div>
      <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
        <div><strong>{t("common.status")}:</strong> {t(`status.plot.${plot.status}`)}</div>
        <div><strong>{t("broker.plots.size")}:</strong> {plot.sizeSqft ? t("broker.sqft", { size: plot.sizeSqft }) : "—"}</div>
        <div><strong>{t("broker.plots.price")}:</strong> {plot.priceInr ? formatInr(plot.priceInr, locale) : "—"}</div>
        {plot.description && <div className="pt-2 text-gray-700">{plot.description}</div>}
      </div>

      <Link
        href={`/dashboard/plots/${plot.id}/design`}
        className="inline-block bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
      >
        {t("broker.plots.designBuilding")}
      </Link>

      {/* AI Co-Pilot: Match Radar + AI Valuation. Loads asynchronously so the
          plot detail still paints instantly while LLM calls fire in the bg. */}
      <CopilotPanel plotId={plot.id} />

      <section>
        <h2 className="font-semibold mb-2">{t("broker.plots.visitsToPlot")}</h2>
        <div className="bg-white border rounded-lg divide-y">
          {plot.visits.length === 0 && (
            <div className="p-4 text-sm text-gray-500">{t("broker.plots.noVisitsScheduled")}</div>
          )}
          {plot.visits.map((v) => (
            <div key={v.id} className="p-3 text-sm flex justify-between">
              <div>
                <div className="font-medium">{v.client.name}</div>
                <div className="text-gray-500">{formatDateTime(v.scheduledAt, locale)}</div>
              </div>
              <span className="text-xs text-gray-500">{t(`status.visit.${v.status}`)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
