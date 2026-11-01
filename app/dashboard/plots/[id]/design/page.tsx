import { notFound } from "next/navigation";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n/server";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";

export default async function DesignForPlotPage({ params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const plot = await prisma.plot.findFirst({
    where: { id: params.id, orgId: user.orgId },
  });
  if (!plot) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("broker.plots.designFor", { title: plot.title })}</h1>
      <p className="text-sm text-gray-500">{plot.location}{plot.sizeSqft ? ` · ${t("broker.sqft", { size: plot.sizeSqft })}` : ""}</p>
      <RequirementsWizard
        source="broker"
        plotId={plot.id}
        defaultPlotSqft={plot.sizeSqft || undefined}
      />
    </div>
  );
}
