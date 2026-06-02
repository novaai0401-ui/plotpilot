import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildWaMeUrl } from "@/lib/whatsapp";
import {
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxButton,
  TkxEmpty,
} from "@/components/tkx-dyn";

export default async function PortalHome() {
  const user = await requireUser(["client"]);
  const [upcomingVisits, agent, org] = await Promise.all([
    prisma.visit.findMany({
      where: { clientId: user.id, status: "scheduled" },
      include: { plot: true, agent: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.user.findFirst({
      where: { orgId: user.orgId, role: { in: ["broker_admin", "broker_agent"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: user.orgId } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hello, {user.name.split(" ")[0]}.</h1>

      <TkxCard variant="elevated" padding="md">
        <TkxCardHeader
          title="Your broker"
          subtitle={agent ? `${agent.name} at ${org?.name}` : org?.name}
        />
        <TkxCardBody>
          {agent && (
            <a
              href={buildWaMeUrl(agent.phone, `Hi ${agent.name}, `)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message ${agent.name} on WhatsApp`}
            >
              <TkxButton variant="solid" colorScheme="success">
                Message broker on WhatsApp
              </TkxButton>
            </a>
          )}
        </TkxCardBody>
      </TkxCard>

      <section>
        <h2 className="font-semibold mb-2">Upcoming visits</h2>
        <TkxCard variant="outlined" padding="none">
          <TkxCardBody>
            {upcomingVisits.length === 0 ? (
              <TkxEmpty description="Nothing scheduled — your broker will schedule plot visits for you here." />
            ) : (
              <div className="divide-y">
                {upcomingVisits.map((v) => (
                  <Link
                    key={v.id}
                    href="/portal/visits"
                    className="block px-4 py-3 hover:bg-gray-50 text-sm"
                  >
                    <div className="font-medium">{v.plot.title}</div>
                    <div className="text-gray-500">
                      {new Date(v.scheduledAt).toLocaleString()} · with {v.agent.name}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TkxCardBody>
        </TkxCard>
      </section>
    </div>
  );
}
