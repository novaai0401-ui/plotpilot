import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function PlotsPage() {
  const user = await requireUser(BROKER_ROLES);
  const plots = await prisma.plot.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Plots</h1>
        <Link
          href="/dashboard/plots/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          + Add plot
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plots.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white border rounded">
            No plots listed yet.
          </div>
        )}
        {plots.map((p) => (
          <div key={p.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{p.title}</div>
                <div className="text-xs text-gray-500">{p.location}</div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  p.status === "available"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {p.status}
              </span>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              {p.sizeSqft ? `${p.sizeSqft} sqft` : ""}
              {p.priceInr ? ` · ₹${p.priceInr.toLocaleString("en-IN")}` : ""}
            </div>
            <Link
              href={`/dashboard/plots/${p.id}`}
              className="mt-3 inline-block text-xs text-brand hover:underline"
            >
              View / edit
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
