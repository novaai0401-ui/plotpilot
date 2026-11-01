import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { TkxBadge, TkxCard, TkxCardBody, TkxEmpty } from "@/components/tkx-dyn";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";

const STATUS_VARIANT: Record<string, "primary" | "success" | "warning" | "default"> = {
  scheduled: "primary",
  completed: "success",
  cancelled: "warning",
};

export default async function ClientVisitsPage() {
  const user = await requireUser(["client"]);
  const locale = getLocale();
  const visits = await prisma.visit.findMany({
    where: { clientId: user.id },
    include: { plot: true, agent: true },
    orderBy: { scheduledAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("public.portal.nav.visits")}</h1>
      <TkxCard variant="outlined" padding="none">
        <TkxCardBody>
          {visits.length === 0 ? (
            <TkxEmpty description={t("public.portal.visits.empty")} />
          ) : (
            <div className="divide-y">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="px-4 py-3 text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="truncate">{v.plot.title}</span>
                      <TkxBadge variant={STATUS_VARIANT[v.status] || "default"}>
                        {t(`status.visit.${v.status}`)}
                      </TkxBadge>
                    </div>
                    <div className="text-gray-500 truncate">
                      {v.plot.location} · {formatDateTime(v.scheduledAt, locale)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("public.portal.withAgent", { name: v.agent.name })}
                    </div>
                  </div>
                  <a
                    href={buildWaMeUrl(
                      v.agent.phone,
                      t("public.portal.visits.waMessage", { name: v.agent.name, plot: v.plot.title })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:underline text-xs font-medium whitespace-nowrap"
                  >
                    {t("public.portal.visits.waLink")}
                  </a>
                </div>
              ))}
            </div>
          )}
        </TkxCardBody>
      </TkxCard>
    </div>
  );
}
