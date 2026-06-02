import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardOverview() {
  const user = await requireUser(BROKER_ROLES);
  const orgId = user.orgId;

  const [clients, plots, scheduled, completed, pendingInvites] = await Promise.all([
    prisma.user.count({ where: { orgId, role: "client" } }),
    prisma.plot.count({ where: { orgId, status: "available" } }),
    prisma.visit.count({ where: { orgId, status: "scheduled" } }),
    prisma.visit.count({ where: { orgId, status: "completed" } }),
    prisma.invitation.count({ where: { orgId, status: "pending" } }),
  ]);

  const cards = [
    { label: "Clients", value: clients },
    { label: "Available plots", value: plots },
    { label: "Visits scheduled", value: scheduled },
    { label: "Visits completed", value: completed },
    { label: "Pending invites", value: pendingInvites },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}.</h1>
        <p className="text-gray-500">Here&apos;s how your brokerage is doing today.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
