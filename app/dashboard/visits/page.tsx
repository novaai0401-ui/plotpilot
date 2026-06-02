import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl, renderTemplate } from "@/lib/whatsapp";

export default async function VisitsPage() {
  const user = await requireUser(BROKER_ROLES);
  const [visits, org] = await Promise.all([
    prisma.visit.findMany({
      where: { orgId: user.orgId },
      orderBy: { scheduledAt: "asc" },
      include: { plot: true, client: true, agent: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.orgId },
      include: { whatsappConfig: true },
    }),
  ]);

  const groups: Record<string, typeof visits> = { Upcoming: [], Past: [] };
  const now = Date.now();
  visits.forEach((v) => {
    (v.scheduledAt.getTime() >= now && v.status === "scheduled"
      ? groups.Upcoming
      : groups.Past
    ).push(v);
  });

  const reminderTemplate =
    org?.whatsappConfig?.reminderTemplate ||
    "Hi {name}, reminder for your visit to {plot} at {time}.";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Visits</h1>
        <Link
          href="/dashboard/visits/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          + Schedule visit
        </Link>
      </div>

      {Object.entries(groups).map(([label, list]) => (
        <section key={label}>
          <h2 className="font-semibold mb-2">{label} ({list.length})</h2>
          <div className="bg-white border rounded-lg divide-y">
            {list.length === 0 && (
              <div className="p-4 text-sm text-gray-500">Nothing here.</div>
            )}
            {list.map((v) => {
              const reminderBody = renderTemplate(reminderTemplate, {
                name: v.client.name,
                plot: v.plot.title,
                time: new Date(v.scheduledAt).toLocaleString(),
              });
              return (
                <div key={v.id} className="p-4 flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium">{v.plot.title}</div>
                    <div className="text-gray-500">
                      with {v.client.name} · {new Date(v.scheduledAt).toLocaleString()} · {v.status}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={buildWaMeUrl(v.client.phone, reminderBody)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline text-xs"
                    >
                      WhatsApp reminder
                    </a>
                    <Link
                      href={`/dashboard/visits/${v.id}`}
                      className="text-brand hover:underline text-xs"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
