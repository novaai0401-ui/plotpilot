import { redirect } from "next/navigation";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

async function createVisit(formData: FormData) {
  "use server";
  const { requireUser, BROKER_ROLES } = await import("@/lib/auth/session");
  const { prisma } = await import("@/lib/db/prisma");
  const { redirect } = await import("next/navigation");
  const user = await requireUser(BROKER_ROLES);

  const plotId = String(formData.get("plotId") || "");
  const clientId = String(formData.get("clientId") || "");
  const scheduledAt = new Date(String(formData.get("scheduledAt") || ""));
  if (!plotId || !clientId || isNaN(scheduledAt.getTime())) throw new Error("missing fields");

  // Verify both belong to org (defense in depth against tampering)
  const [plot, client] = await Promise.all([
    prisma.plot.findFirst({ where: { id: plotId, orgId: user.orgId } }),
    prisma.user.findFirst({ where: { id: clientId, orgId: user.orgId, role: "client" } }),
  ]);
  if (!plot || !client) throw new Error("invalid plot or client");

  await prisma.visit.create({
    data: {
      orgId: user.orgId,
      plotId,
      clientId,
      agentId: user.id,
      scheduledAt,
      notes: String(formData.get("notes") || "") || null,
    },
  });
  await prisma.analyticsEvent.create({
    data: {
      orgId: user.orgId,
      type: "visit.scheduled",
      actorId: user.id,
      metadata: { plotId, clientId },
    },
  });
  redirect("/dashboard/visits");
}

export default async function NewVisitPage() {
  const user = await requireUser(BROKER_ROLES);
  const [plots, clients] = await Promise.all([
    prisma.plot.findMany({ where: { orgId: user.orgId, status: "available" }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { orgId: user.orgId, role: "client" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Schedule a visit</h1>
      <form action={createVisit} className="space-y-3 bg-white border rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <select name="clientId" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.phone}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="text-xs text-yellow-700 mt-1">
              No clients yet. Invite one first from Invitations → New.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plot *</label>
          <select name="plotId" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Select plot</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.location}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date &amp; time *</label>
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">Schedule</button>
      </form>
    </div>
  );
}
