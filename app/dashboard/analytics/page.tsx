import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { EVENT_LABELS } from "@/lib/audit-log/events";
import { t } from "@/lib/i18n/server";

export default async function AnalyticsPage() {
  const user = await requireUser(BROKER_ROLES);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await prisma.analyticsEvent.findMany({
    where: { orgId: user.orgId, createdAt: { gte: since } },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucket by day for charting
  const byDay: Record<string, Record<string, number>> = {};
  events.forEach((e) => {
    const day = e.createdAt.toISOString().slice(0, 10);
    byDay[day] ??= {};
    byDay[day][e.type] = (byDay[day][e.type] || 0) + 1;
  });
  const series = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({ day, ...counts }));

  // Totals
  const totals: Record<string, number> = {};
  events.forEach((e) => (totals[e.type] = (totals[e.type] || 0) + 1));

  // Conversion: accepted / sent
  const invitesSent = totals["invitation.sent"] || 0;
  const invitesAccepted = totals["invitation.accepted"] || 0;
  const conversion = invitesSent ? Math.round((invitesAccepted / invitesSent) * 100) : 0;

  const seriesLabels = Object.fromEntries(
    Object.entries(EVENT_LABELS).map(([type, event]) => [type, t(event.labelKey)])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("account.analytics.title")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label={t("account.analytics.invitesSent")} value={invitesSent} />
        <Kpi label={t("account.analytics.invitesAccepted")} value={invitesAccepted} />
        <Kpi label={t("account.analytics.conversion")} value={`${conversion}%`} />
        <Kpi label={t("account.analytics.messagesSent")} value={totals["message.sent"] || 0} />
        <Kpi label={t("account.analytics.visitsScheduled")} value={totals["visit.scheduled"] || 0} />
        <Kpi label={t("account.analytics.visitsCompleted")} value={totals["visit.completed"] || 0} />
        <Kpi label={t("account.analytics.visitsCancelled")} value={totals["visit.cancelled"] || 0} />
        <Kpi label={t("account.analytics.plotsCreated")} value={totals["plot.created"] || 0} />
      </div>

      <AnalyticsCharts series={series} seriesLabels={seriesLabels} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
