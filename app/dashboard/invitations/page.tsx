import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n/server";
import { buildWaMeUrl, renderTemplate } from "@/lib/whatsapp";

export default async function InvitationsPage() {
  const user = await requireUser(BROKER_ROLES);
  const [invites, org] = await Promise.all([
    prisma.invitation.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      include: { sentBy: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.orgId },
      include: { whatsappConfig: true },
    }),
  ]);

  const baseUrl = appUrl();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("nav.invitations")}</h1>
        <Link
          href="/dashboard/invitations/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          {t("broker.invitations.new")}
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">{t("common.client")}</th>
              <th className="p-3">{t("common.phone")}</th>
              <th className="p-3">{t("common.status")}</th>
              <th className="p-3">{t("broker.invitations.sentBy")}</th>
              <th className="p-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  {t("broker.invitations.empty")}
                </td>
              </tr>
            )}
            {invites.map((i) => {
              const inviteUrl = `${baseUrl}/signup?invite=${i.token}`;
              const template =
                org?.whatsappConfig?.inviteTemplate ||
                t("broker.invitations.waTemplate");
              const body = renderTemplate(template, {
                name: i.clientName || t("broker.invitations.waNameFallback"),
                broker: i.sentBy.name,
                org: org?.name || "",
                link: inviteUrl,
              });
              return (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{i.clientName || "—"}</td>
                  <td className="p-3">{i.clientPhone}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        i.status === "accepted"
                          ? "bg-green-100 text-green-700"
                          : i.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {t(`status.invitation.${i.status}`)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{i.sentBy.name}</td>
                  <td className="p-3">
                    {i.status === "pending" && (
                      <a
                        href={buildWaMeUrl(i.clientPhone, body)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline text-xs"
                      >
                        {t("broker.invitations.sendWhatsApp")}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
