import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import { buildWaMeUrl } from "@/lib/whatsapp";

export default async function ClientsPage() {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const clients = await prisma.user.findMany({
    where: { orgId: user.orgId, role: "client" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { visitsAsClient: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("nav.clients")}</h1>
        <Link
          href="/dashboard/invitations/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          {t("broker.clients.invite")}
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">{t("common.name")}</th>
              <th className="p-3">{t("common.phone")}</th>
              <th className="p-3">{t("broker.visits.title")}</th>
              <th className="p-3">{t("broker.joined")}</th>
              <th className="p-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  {t("broker.clients.empty")}
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c._count.visitsAsClient}</td>
                <td className="p-3 text-gray-500">
                  {formatDate(c.createdAt, locale)}
                </td>
                <td className="p-3 flex gap-2">
                  <a
                    href={buildWaMeUrl(c.phone, t("broker.clients.waGreeting", { name: c.name }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline text-xs"
                  >
                    {t("channel.whatsapp_deeplink")}
                  </a>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="text-brand hover:underline text-xs"
                  >
                    {t("common.view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
