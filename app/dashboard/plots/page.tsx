import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatInr } from "@/lib/i18n/format";
import { t, getLocale } from "@/lib/i18n/server";

export default async function PlotsPage() {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const plots = await prisma.plot.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("nav.plots")}</h1>
        <Link
          href="/dashboard/plots/new"
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark"
        >
          {t("broker.plots.add")}
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plots.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white border rounded">
            {t("broker.plots.empty")}
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
                {t(`status.plot.${p.status}`)}
              </span>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              {p.sizeSqft ? t("broker.sqft", { size: p.sizeSqft }) : ""}
              {p.priceInr ? ` · ${formatInr(p.priceInr, locale)}` : ""}
            </div>
            <Link
              href={`/dashboard/plots/${p.id}`}
              className="mt-3 inline-block text-xs text-brand hover:underline"
            >
              {t("broker.plots.viewEdit")}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
