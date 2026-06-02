import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DesignsListPage() {
  const user = await requireUser(BROKER_ROLES);
  const designs = await prisma.buildingDesign.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    include: { plot: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Building designs</h1>
        <Link
          href="/dashboard/designs/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          + New design
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {designs.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white border rounded">
            No designs yet. Start one from a plot or click "+ New design".
          </div>
        )}
        {designs.map((d) => {
          const req = d.requirements as any;
          const brief = d.brief as any;
          return (
            <Link
              key={d.id}
              href={`/designs/${d.id}`}
              className="bg-white border rounded-lg p-4 hover:shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{req?.projectType || "—"}</div>
                  <div className="text-xs text-gray-500">
                    {brief?.summary?.totalSqftPlot} sqft · {brief?.summary?.floors} floor(s) · {d.source}
                  </div>
                  {d.plot && (
                    <div className="text-xs text-gray-500 mt-1">
                      For plot: <strong>{d.plot.title}</strong>
                    </div>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    d.status === "ready"
                      ? "bg-green-100 text-green-700"
                      : d.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {new Date(d.createdAt).toLocaleString()}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
