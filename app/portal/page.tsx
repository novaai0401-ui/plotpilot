import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import {
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxButton,
  TkxEmpty,
} from "@/components/tkx-dyn";

export default async function PortalHome() {
  const user = await requireUser(["client"]);
  const locale = getLocale();
  const [upcomingVisits, agent, org] = await Promise.all([
    prisma.visit.findMany({
      where: { clientId: user.id, status: "scheduled" },
      include: { plot: true, agent: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.user.findFirst({
      where: { orgId: user.orgId, role: { in: ["broker_admin", "broker_agent"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: user.orgId } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {t("public.portal.hello", { name: user.name.split(" ")[0] ?? "" })}
      </h1>

      <TkxCard variant="elevated" padding="md">
        <TkxCardHeader
          title={t("public.portal.yourBroker")}
          subtitle={
            agent
              ? t("public.portal.brokerAt", { name: agent.name, org: org?.name ?? "" })
              : org?.name
          }
        />
        <TkxCardBody>
          {agent && (
            <a
              href={buildWaMeUrl(agent.phone, t("public.portal.waGreeting", { name: agent.name }))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("public.portal.waAria", { name: agent.name })}
            >
              <TkxButton variant="solid" colorScheme="success">
                {t("public.portal.waButton")}
              </TkxButton>
            </a>
          )}
        </TkxCardBody>
      </TkxCard>

      <section>
        <h2 className="font-semibold mb-2">{t("public.portal.upcomingVisits")}</h2>
        <TkxCard variant="outlined" padding="none">
          <TkxCardBody>
            {upcomingVisits.length === 0 ? (
              <TkxEmpty description={t("public.portal.noUpcoming")} />
            ) : (
              <div className="divide-y">
                {upcomingVisits.map((v) => (
                  <Link
                    key={v.id}
                    href="/portal/visits"
                    className="block px-4 py-3 hover:bg-gray-50 text-sm"
                  >
                    <div className="font-medium">{v.plot.title}</div>
                    <div className="text-gray-500">
                      {formatDateTime(v.scheduledAt, locale)} ·{" "}
                      {t("public.portal.withAgent", { name: v.agent.name })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TkxCardBody>
        </TkxCard>
      </section>
    </div>
  );
}
