import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import { buildWaMeUrl, renderTemplate } from "@/lib/whatsapp";

export default async function VisitsPage() {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const [visits, org] = await Promise.all([
    prisma.visit.findMany({
      where: { orgId: user.orgId },
      orderBy: { scheduledAt: "asc" },
      include: { plot: true, client: true, agent: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.orgId },
      include: { whatsappConfig: true },
    }),
  ]);

  const groups: Record<string, typeof visits> = { Upcoming: [], Past: [] };
  const now = Date.now();
  visits.forEach((v) => {
    (v.scheduledAt.getTime() >= now && v.status === "scheduled"
      ? groups.Upcoming
      : groups.Past
    ).push(v);
  });

  const reminderTemplate =
    org?.whatsappConfig?.reminderTemplate ||
    t("broker.visits.waReminderTemplate");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("broker.visits.title")}</h1>
        <Link
          href="/dashboard/visits/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          {t("broker.visits.schedule")}
        </Link>
      </div>

      {Object.entries(groups).map(([label, list]) => (
        <section key={label}>
          <h2 className="font-semibold mb-2">{t(`broker.visits.group.${label}`)} ({list.length})</h2>
          <div className="bg-white border rounded-lg divide-y">
            {list.length === 0 && (
              <div className="p-4 text-sm text-gray-500">{t("broker.visits.nothingHere")}</div>
            )}
            {list.map((v) => {
              const reminderBody = renderTemplate(reminderTemplate, {
                name: v.client.name,
                plot: v.plot.title,
                time: formatDateTime(v.scheduledAt, locale),
              });
              return (
                <div key={v.id} className="p-4 flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium">{v.plot.title}</div>
                    <div className="text-gray-500">
                      {t("broker.visits.withClient", { name: v.client.name })} · {formatDateTime(v.scheduledAt, locale)} · {t(`status.visit.${v.status}`)}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={buildWaMeUrl(v.client.phone, reminderBody)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline text-xs"
                    >
                      {t("broker.visits.whatsappReminder")}
                    </a>
                    <Link
                      href={`/dashboard/visits/${v.id}`}
                      className="text-brand hover:underline text-xs"
                    >
                      {t("common.details")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
