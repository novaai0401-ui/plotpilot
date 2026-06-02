import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { TkxBadge, TkxCard, TkxCardBody, TkxEmpty } from "@/components/tkx-dyn";

const STATUS_VARIANT: Record<string, "primary" | "success" | "warning" | "default"> = {
  scheduled: "primary",
  completed: "success",
  cancelled: "warning",
};

export default async function ClientVisitsPage() {
  const user = await requireUser(["client"]);
  const visits = await prisma.visit.findMany({
    where: { clientId: user.id },
    include: { plot: true, agent: true },
    orderBy: { scheduledAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My visits</h1>
      <TkxCard variant="outlined" padding="none">
        <TkxCardBody>
          {visits.length === 0 ? (
            <TkxEmpty description="No visits yet — once your broker schedules a visit, it'll appear here." />
          ) : (
            <div className="divide-y">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="px-4 py-3 text-sm flex justify-between items-center gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="truncate">{v.plot.title}</span>
                      <TkxBadge variant={STATUS_VARIANT[v.status] || "default"}>
                        {v.status}
                      </TkxBadge>
                    </div>
                    <div className="text-gray-500 truncate">
                      {v.plot.location} · {new Date(v.scheduledAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">with {v.agent.name}</div>
                  </div>
                  <a
                    href={buildWaMeUrl(
                      v.agent.phone,
                      `Hi ${v.agent.name}, regarding my visit to ${v.plot.title}: `
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:underline text-xs font-medium whitespace-nowrap"
                  >
                    WhatsApp broker →
                  </a>
                </div>
              ))}
            </div>
          )}
        </TkxCardBody>
      </TkxCard>
    </div>
  );
}
