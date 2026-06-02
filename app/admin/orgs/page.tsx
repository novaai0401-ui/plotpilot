import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function OrgsListPage() {
  await requireUser(["super_admin"]);
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, plots: true, visits: true, messages: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-left text-xs uppercase text-gray-300">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Plan</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Users</th>
              <th className="p-3">Plots</th>
              <th className="p-3">Visits</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                <td className="p-3 font-medium">{o.name}</td>
                <td className="p-3">{o.plan}</td>
                <td className="p-3 text-gray-400">{o.whatsappMode}</td>
                <td className="p-3">{o._count.users}</td>
                <td className="p-3">{o._count.plots}</td>
                <td className="p-3">{o._count.visits}</td>
                <td className="p-3 text-gray-400">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <Link
                    href={`/admin/orgs/${o.id}`}
                    className="text-teal-400 hover:underline text-xs"
                  >
                    Manage
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
