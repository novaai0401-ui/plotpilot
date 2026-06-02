import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AnalyticsCharts } from "@/components/analytics-charts";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics (last 30 days)</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Invitations sent" value={invitesSent} />
        <Kpi label="Invitations accepted" value={invitesAccepted} />
        <Kpi label="Conversion" value={`${conversion}%`} />
        <Kpi label="Messages sent" value={totals["message.sent"] || 0} />
        <Kpi label="Visits scheduled" value={totals["visit.scheduled"] || 0} />
        <Kpi label="Visits completed" value={totals["visit.completed"] || 0} />
        <Kpi label="Visits cancelled" value={totals["visit.cancelled"] || 0} />
        <Kpi label="Plots created" value={totals["plot.created"] || 0} />
      </div>

      <AnalyticsCharts series={series} />
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
