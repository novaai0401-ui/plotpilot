import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { InviteTeammateForm } from "@/components/team/invite-form";

export default async function TeamPage() {
  const user = await requireUser(BROKER_ROLES);
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
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-gray-500 text-sm mt-1">Manage agents and admins in your organization.</p>
      </div>

      <section>
        <h2 className="font-semibold text-sm mb-2">Current members ({teammates.length})</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {teammates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-medium">
                    {t.name}
                    {t.id === user.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="p-3 text-gray-600">{t.email || "—"}</td>
                  <td className="p-3 text-gray-600">{t.phone}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        t.role === "broker_admin"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {t.role}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user.role === "broker_admin" && (
        <section>
          <h2 className="font-semibold text-sm mb-2">Invite a teammate</h2>
          <InviteTeammateForm />
        </section>
      )}

      <section>
        <h2 className="font-semibold text-sm mb-2">Recent team activity</h2>
        <div className="bg-white border rounded-lg divide-y">
          {recentInvites.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No team invites sent yet.</div>
          )}
          {recentInvites.map((e) => {
            const meta = (e.metadata as any) || {};
            return (
              <div key={e.id} className="p-3 text-sm flex justify-between">
                <span>
                  <strong>
                    {e.type === "team.invite.sent" ? "📨 Invited" : "✓ Accepted"}
                  </strong>{" "}
                  {meta.invitedEmail || meta.email || "—"}{" "}
                  <span className="text-gray-500">({meta.role || "broker_agent"})</span>
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
