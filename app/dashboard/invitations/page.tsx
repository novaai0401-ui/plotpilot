import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Invitations</h1>
        <Link
          href="/dashboard/invitations/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          + New invitation
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Client</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sent by</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No invitations yet.
                </td>
              </tr>
            )}
            {invites.map((i) => {
              const inviteUrl = `${appUrl}/signup?invite=${i.token}`;
              const template =
                org?.whatsappConfig?.inviteTemplate ||
                "Hi {name}, {broker} invites you to view properties. Sign up: {link}";
              const body = renderTemplate(template, {
                name: i.clientName || "there",
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
                      {i.status}
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
                        Send via WhatsApp
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
