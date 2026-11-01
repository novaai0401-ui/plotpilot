import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EXPORTERS, type ExportTable } from "@/lib/data-export/exporters";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { getLocale, t } from "@/lib/i18n/server";

export default async function DataExportPage() {
  const user = await requireUser(["broker_admin", "super_admin"]);
  const locale = getLocale();

  // Show row counts so the broker knows what they're about to download
  const [clients, plots, visits, invitations, messages, designs, usage] = await Promise.all([
    prisma.user.count({ where: { orgId: user.orgId, role: "client" } }),
    prisma.plot.count({ where: { orgId: user.orgId } }),
    prisma.visit.count({ where: { orgId: user.orgId } }),
    prisma.invitation.count({ where: { orgId: user.orgId } }),
    prisma.message.count({ where: { orgId: user.orgId } }),
    prisma.buildingDesign.count({ where: { orgId: user.orgId } }),
    prisma.usageEvent.count({ where: { orgId: user.orgId } }),
  ]);
  const counts: Record<ExportTable, number> = {
    clients,
    plots,
    visits,
    invitations,
    messages,
    designs,
    usage,
  };

  const previousExports = await prisma.analyticsEvent.findMany({
    where: { orgId: user.orgId, type: "data.exported" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:underline">
          {t("account.backToSettings")}
        </Link>
        <h1 className="text-2xl font-bold mt-1">{t("account.export.title")}</h1>
        <p className="text-gray-500 text-sm mt-1">{t("account.export.intro")}</p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm space-y-2">
        <div className="font-semibold text-blue-900">{t("account.export.privacyTitle")}</div>
        <ul className="list-disc pl-5 text-blue-900/80 space-y-1">
          <li>{fill(t("account.export.privacy1"), <strong>{t("account.export.privacy1Term")}</strong>)}</li>
          <li>{fill(t("account.export.privacy2"), <strong>{t("account.export.privacy2Term")}</strong>)}</li>
          <li>
            {fill(
              t("account.export.privacy3"),
              <>
                <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>
              </>
            )}
          </li>
          <li>{fill(t("account.export.privacy4"), <strong>{t("account.export.privacy4Term")}</strong>)}</li>
        </ul>
      </div>

      <section>
        <h2 className="font-semibold text-sm mb-2">{t("account.export.available")}</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 text-left">{t("account.export.colTable")}</th>
                <th className="p-3 text-right">{t("account.export.colRows")}</th>
                <th className="p-3 text-left">{t("account.export.colIncludes")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(EXPORTERS) as ExportTable[]).map((table) => (
                <tr key={table} className="border-t">
                  <td className="p-3 font-medium">{t(`account.export.table.${table}`)}</td>
                  <td className="p-3 text-right">{formatNumber(counts[table], locale)}</td>
                  <td className="p-3 text-gray-500 text-xs">{t(`account.export.includes.${table}`)}</td>
                  <td className="p-3 text-right">
                    {counts[table] > 0 ? (
                      <a
                        href={`/api/data-export/${table}`}
                        className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50 inline-block"
                      >
                        ⬇ CSV
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">{t("account.export.noData")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previousExports.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm mb-2">{t("account.export.recent")}</h2>
          <div className="bg-white border rounded-lg divide-y">
            {previousExports.map((e) => {
              const meta = (e.metadata as any) || {};
              const tableLabel =
                meta.table in EXPORTERS || meta.table === "audit_log"
                  ? t(`account.export.table.${meta.table}`)
                  : meta.table;
              return (
                <div key={e.id} className="p-3 text-xs flex justify-between text-gray-600">
                  <span>
                    📥{" "}
                    {fill(
                      t("account.export.exported", {
                        size: meta.sizeBytes ? ` (${formatBytes(meta.sizeBytes)})` : "",
                      }),
                      <strong>{tableLabel}</strong>
                    )}
                  </span>
                  <span>{formatDateTime(e.createdAt, locale)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** Puts `node` where a translated string has its one remaining {placeholder}. */
function fill(template: string, node: ReactNode) {
  const [before, after] = template.split(/\{\w+\}/);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
