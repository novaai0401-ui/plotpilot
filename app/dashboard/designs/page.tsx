import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { t, getLocale } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/format";

export default async function DesignsListPage() {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const designs = await prisma.buildingDesign.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    include: { plot: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("design.list.title")}</h1>
        <Link
          href="/dashboard/designs/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          {t("design.list.new")}
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {designs.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white border rounded">
            {t("design.list.empty")}
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
                  <div className="font-semibold">
                    {req?.projectType ? t(`design.projectType.${req.projectType}`) : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t("design.sqftValue", { value: brief?.summary?.totalSqftPlot ?? "" })} ·{" "}
                    {t("design.list.floors", { count: brief?.summary?.floors ?? "" })} ·{" "}
                    {t(`design.source.${d.source}`)}
                  </div>
                  {d.plot && (
                    <div className="text-xs text-gray-500 mt-1">
                      {t("design.list.forPlot")} <strong>{d.plot.title}</strong>
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
                  {t(`design.status.${d.status}`)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {formatDateTime(d.createdAt, locale)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
