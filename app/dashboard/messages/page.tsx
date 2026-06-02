import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function MessagesPage() {
  const user = await requireUser(BROKER_ROLES);
  const messages = await prisma.message.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { sender: true, recipient: true, visit: { include: { plot: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="bg-white border rounded-lg divide-y">
        {messages.length === 0 && (
          <div className="p-6 text-sm text-gray-500 text-center">No messages yet.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="p-4 text-sm">
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {m.sender.name} → {m.recipient.name}
                {m.visit ? ` · re: ${m.visit.plot.title}` : ""}
              </span>
              <span>
                {m.channel} · {m.status} · {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-1">{m.body}</div>
            {m.errorMessage && (
              <div className="text-xs text-red-600 mt-1">{m.errorMessage}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
