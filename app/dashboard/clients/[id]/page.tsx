import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import { buildWaMeUrl } from "@/lib/whatsapp";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const client = await prisma.user.findFirst({
    where: { id: params.id, orgId: user.orgId, role: "client" },
    include: {
      visitsAsClient: { include: { plot: true }, orderBy: { scheduledAt: "desc" } },
      receivedMessages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!client) notFound();
  const locale = getLocale();

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/clients" className="text-sm text-gray-500 hover:underline">
        {t("broker.clients.back")}
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="text-gray-500">{client.phone} · {client.email || t("broker.emailOptionalNone")}</div>
        </div>
        <a
          href={buildWaMeUrl(client.phone, t("broker.clients.waGreetingShort", { name: client.name }))}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
        >
          {t("broker.openWhatsApp")}
        </a>
      </div>

      <section>
        <h2 className="font-semibold mb-2">{t("broker.visits.title")}</h2>
        <div className="bg-white border rounded-lg divide-y">
          {client.visitsAsClient.length === 0 && (
            <div className="p-4 text-sm text-gray-500">{t("broker.noVisits")}</div>
          )}
          {client.visitsAsClient.map((v) => (
            <div key={v.id} className="p-4 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{v.plot.title}</div>
                <div className="text-gray-500">
                  {formatDateTime(v.scheduledAt, locale)} · {t(`status.visit.${v.status}`)}
                </div>
              </div>
              <Link href={`/dashboard/visits/${v.id}`} className="text-brand hover:underline">
                {t("common.details")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">{t("broker.clients.recentMessages")}</h2>
        <div className="bg-white border rounded-lg divide-y">
          {client.receivedMessages.length === 0 && (
            <div className="p-4 text-sm text-gray-500">{t("broker.noMessages")}</div>
          )}
          {client.receivedMessages.map((m) => (
            <div key={m.id} className="p-3 text-sm">
              <div className="text-xs text-gray-500">
                {t(`channel.${m.channel}`)} · {t(`status.message.${m.status}`)} · {formatDateTime(m.createdAt, locale)}
              </div>
              <div className="mt-1">{m.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
