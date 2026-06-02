import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CopilotPanel } from "@/components/plot/copilot-panel";

export default async function PlotDetail({ params }: { params: { id: string } }) {
  const user = await requireUser(BROKER_ROLES);
  const plot = await prisma.plot.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { visits: { include: { client: true }, orderBy: { scheduledAt: "desc" } } },
  });
  if (!plot) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/plots" className="text-sm text-gray-500 hover:underline">
        ← Back to plots
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{plot.title}</h1>
        <div className="text-gray-500">{plot.location}</div>
      </div>
      <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
        <div><strong>Status:</strong> {plot.status}</div>
        <div><strong>Size:</strong> {plot.sizeSqft ? `${plot.sizeSqft} sqft` : "—"}</div>
        <div><strong>Price:</strong> {plot.priceInr ? `₹${plot.priceInr.toLocaleString("en-IN")}` : "—"}</div>
        {plot.description && <div className="pt-2 text-gray-700">{plot.description}</div>}
      </div>

      <Link
        href={`/dashboard/plots/${plot.id}/design`}
        className="inline-block bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
      >
        Design a building for this plot →
      </Link>

      {/* AI Co-Pilot: Match Radar + AI Valuation. Loads asynchronously so the
          plot detail still paints instantly while LLM calls fire in the bg. */}
      <CopilotPanel plotId={plot.id} />

      <section>
        <h2 className="font-semibold mb-2">Visits to this plot</h2>
        <div className="bg-white border rounded-lg divide-y">
          {plot.visits.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No visits scheduled yet.</div>
          )}
          {plot.visits.map((v) => (
            <div key={v.id} className="p-3 text-sm flex justify-between">
              <div>
                <div className="font-medium">{v.client.name}</div>
                <div className="text-gray-500">{new Date(v.scheduledAt).toLocaleString()}</div>
              </div>
              <span className="text-xs text-gray-500">{v.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
