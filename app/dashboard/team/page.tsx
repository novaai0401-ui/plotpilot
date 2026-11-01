import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";
import { InviteTeammateForm } from "@/components/team/invite-form";

export default async function TeamPage() {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const teammates = await prisma.user.findMany({
    where: {
      orgId: user.orgId,
      role: { in: ["broker_admin", "broker_agent"] },
    },
    orderBy: { createdAt: "asc" },
  });
  const recentInvites = await prisma.analyticsEvent.findMany({
    where: { orgId: user.orgId, type: { in: ["team.invite.sent", "team.invite.accepted"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("nav.team")}</h1>
        <p className="text-gray-500 text-sm mt-1">{t("broker.team.subtitle")}</p>
      </div>

      <section>
        <h2 className="font-semibold text-sm mb-2">{t("broker.team.currentMembers", { count: teammates.length })}</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">{t("common.name")}</th>
                <th className="p-3 text-left">{t("common.email")}</th>
                <th className="p-3 text-left">{t("common.phone")}</th>
                <th className="p-3 text-left">{t("broker.team.role")}</th>
                <th className="p-3 text-left">{t("broker.joined")}</th>
              </tr>
            </thead>
            <tbody>
              {teammates.map((member) => (
                <tr key={member.id} className="border-t">
                  <td className="p-3 font-medium">
                    {member.name}
                    {member.id === user.id && <span className="ml-2 text-xs text-gray-400">{t("broker.team.you")}</span>}
                  </td>
                  <td className="p-3 text-gray-600">{member.email || "—"}</td>
                  <td className="p-3 text-gray-600">{member.phone}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        member.role === "broker_admin"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {t(`role.${member.role}`)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {formatDate(member.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user.role === "broker_admin" && (
        <section>
          <h2 className="font-semibold text-sm mb-2">{t("broker.team.inviteTeammate")}</h2>
          <InviteTeammateForm />
        </section>
      )}

      <section>
        <h2 className="font-semibold text-sm mb-2">{t("broker.team.recentActivity")}</h2>
        <div className="bg-white border rounded-lg divide-y">
          {recentInvites.length === 0 && (
            <div className="p-4 text-sm text-gray-500">{t("broker.team.noInvites")}</div>
          )}
          {recentInvites.map((e) => {
            const meta = (e.metadata as any) || {};
            return (
              <div key={e.id} className="p-3 text-sm flex justify-between">
                <span>
                  <strong>
                    {e.type === "team.invite.sent" ? `📨 ${t("broker.team.invited")}` : `✓ ${t("broker.team.accepted")}`}
                  </strong>{" "}
                  {meta.invitedEmail || meta.email || "—"}{" "}
                  <span className="text-gray-500">({t(`role.${meta.role || "broker_agent"}`)})</span>
                </span>
                <span className="text-xs text-gray-500">
                  {formatDateTime(e.createdAt, locale)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
