import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl } from "@/lib/whatsapp";

export default async function ClientsPage() {
  const user = await requireUser(BROKER_ROLES);
  const clients = await prisma.user.findMany({
    where: { orgId: user.orgId, role: "client" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { visitsAsClient: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          href="/dashboard/invitations/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          + Invite client
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Visits</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No clients yet — invite your first one.
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c._count.visitsAsClient}</td>
                <td className="p-3 text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 flex gap-2">
                  <a
                    href={buildWaMeUrl(c.phone, `Hi ${c.name}, hope you're doing well.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline text-xs"
                  >
                    WhatsApp
                  </a>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="text-brand hover:underline text-xs"
                  >
                    View
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
