"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/client";

// Three.js is heavy and only loaded when the user clicks the 3D tab
const Building3DViewer = dynamic(
  () => import("./building-3d-viewer").then((m) => m.Building3DViewer),
  { ssr: false, loading: () => <Viewer3DLoading /> }
);

function Viewer3DLoading() {
  const t = useT();
  return <div className="p-8 text-center text-sm text-gray-500">{t("design.viewer.loading3d")}</div>;
}

type FloorPlanSvg = { floor: number; label: string; svg: string };

type Brief = {
  summary: any;
  floors: Array<{ floor: number; label: string; rooms: any[]; netSqft: number }>;
  materials: string[];
  mep: string[];
  codeNotes: string[];
  costEstimateInr?: { low: number; high: number; perSqftInr: number };
  warnings: string[];
};

export function DesignViewer({
  brief,
  narrative,
  floorPlansSvg,
  renderImageUrl,
  designId,
}: {
  brief: Brief;
  narrative: string | null;
  floorPlansSvg: FloorPlanSvg[];
  renderImageUrl: string | null;
  designId?: string;
}) {
  const t = useT();
  const [activeFloor, setActiveFloor] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const current = floorPlansSvg.find((f) => f.floor === activeFloor) || floorPlansSvg[0];
  const [notNativeBefore, notNativeAfter] = t("design.viewer.notNative").split("{dwg}");

  return (
    <div className="space-y-8">
      {/* Action bar: exports */}
      {designId && (
        <div className="flex flex-wrap items-start justify-end gap-3">
          <div className="text-right text-xs text-gray-500 max-w-xs">
            <div className="font-medium text-gray-700 mb-0.5">{t("design.viewer.exportFormats")}</div>
            <div>
              <strong>PDF</strong> — {t("design.viewer.pdfHelp")}
            </div>
            <div className="mt-0.5">
              <strong>DXF</strong> — {t("design.viewer.dxfHelp")}{" "}
              <span className="text-gray-400">
                <em>{notNativeBefore}<code>.dwg</code>{notNativeAfter}</em>
                {" "}
                <a
                  href="https://en.wikipedia.org/wiki/AutoCAD_DXF"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                  title={t("design.viewer.dxfDiffTitle")}
                >
                  {t("design.viewer.whatsTheDifference")}
                </a>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={`/api/architect/export/${designId}/pdf`}
              className="px-4 py-2 text-sm border rounded bg-white hover:bg-gray-50 font-medium whitespace-nowrap"
            >
              ⬇ {t("design.viewer.downloadPdf")}
            </a>
            <a
              href={`/api/architect/export/${designId}/dxf`}
              className="px-4 py-2 text-sm border rounded bg-white hover:bg-gray-50 font-medium whitespace-nowrap"
              title={t("design.viewer.dxfTitle")}
            >
              ⬇ {t("design.viewer.downloadDxf")} <span className="text-gray-400">(.dxf)</span>
            </a>
            <button
              type="button"
              disabled
              title={t("design.viewer.dwgTitle")}
              className="px-4 py-2 text-sm border rounded bg-gray-50 text-gray-400 font-medium whitespace-nowrap cursor-not-allowed flex items-center gap-1.5"
            >
              ⬇ {t("design.viewer.downloadDwg")}
              <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                {t("design.viewer.enterprise")}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* AI render image hero */}
      {renderImageUrl && (
        <section>
          <h2 className="text-xl font-bold mb-3">{t("design.viewer.conceptRender")}</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="relative">
              <img src={renderImageUrl} alt={t("design.viewer.renderAlt")} className="w-full h-auto" />
              <span className="absolute top-2 left-2 bg-amber-100 text-amber-900 text-xs font-semibold px-2 py-1 rounded border border-amber-300 shadow-sm">
                {t("design.viewer.renderBadge")}
              </span>
            </div>
            <p className="text-xs text-gray-600 p-3 border-t bg-gray-50">
              <strong>⚠ {t("design.viewer.important")}</strong> {t("design.viewer.renderNotice")}
            </p>
          </div>
        </section>
      )}

      {/* Summary KPIs */}
      <section>
        <h2 className="text-xl font-bold mb-3">{t("design.viewer.summary")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("design.viewer.plotArea")} value={t("design.sqftValue", { value: brief.summary.totalSqftPlot })} />
          <Kpi label={t("design.viewer.builtUp")} value={t("design.sqftValue", { value: brief.summary.plannedBuiltUpSqft })} />
          <Kpi label={t("design.viewer.farUsed")} value={`${brief.summary.farUsedPct}%`} />
          <Kpi label={t("design.viewer.footprint")} value={`${brief.summary.footprintWidthFt}' × ${brief.summary.footprintDepthFt}'`} />
          {brief.costEstimateInr && (
            <Kpi
              label={t("design.viewer.estCost")}
              value={t("design.costRange", {
                low: (brief.costEstimateInr.low / 100000).toFixed(0),
                high: (brief.costEstimateInr.high / 100000).toFixed(0),
              })}
              hint={t("design.perSqft", { rate: brief.costEstimateInr.perSqftInr })}
            />
          )}
        </div>
        {brief.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm space-y-1">
            <strong>⚠ {t("design.viewer.warnings")}</strong>
            <ul className="list-disc pl-5">
              {brief.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Floor plans (2D / 3D toggle) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">{t("design.viewer.floorPlans")}</h2>
          <div className="inline-flex border rounded overflow-hidden text-xs">
            <button
              onClick={() => setView("2d")}
              className={`px-3 py-1.5 ${view === "2d" ? "bg-brand text-white" : "bg-white hover:bg-gray-50"}`}
            >
              2D
            </button>
            <button
              onClick={() => setView("3d")}
              className={`px-3 py-1.5 ${view === "3d" ? "bg-brand text-white" : "bg-white hover:bg-gray-50"}`}
            >
              3D
            </button>
          </div>
        </div>

        {view === "3d" ? (
          <Building3DViewer brief={brief as any} />
        ) : (
          <div className="bg-white border rounded-lg">
            <div className="flex border-b overflow-x-auto">
              {floorPlansSvg.map((f) => (
                <button
                  key={f.floor}
                  onClick={() => setActiveFloor(f.floor)}
                  className={`px-4 py-2 text-sm border-r whitespace-nowrap ${
                    activeFloor === f.floor
                      ? "bg-brand text-white"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="p-4 overflow-x-auto">
              {/* eslint-disable-next-line react/no-danger */}
              <div className="[&>svg]:max-w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: current?.svg || "" }} />
            </div>
          </div>
        )}

        {/* Room list for active floor (only in 2D view) */}
        {view === "2d" && brief.floors[activeFloor] && (
          <div className="mt-3 bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="p-2 text-left">{t("design.viewer.room")}</th>
                  <th className="p-2 text-left">{t("design.viewer.type")}</th>
                  <th className="p-2 text-right">{t("design.viewer.dimensions")}</th>
                  <th className="p-2 text-right">{t("design.viewer.area")}</th>
                  <th className="p-2 text-right">{t("design.viewer.estCost")}</th>
                </tr>
              </thead>
              <tbody>
                {brief.floors[activeFloor].rooms.map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-gray-500 text-xs">{t(`design.roomType.${r.type}`)}</td>
                    <td className="p-2 text-right">{r.widthFt}' × {r.depthFt}'</td>
                    <td className="p-2 text-right">{t("design.sqftValue", { value: r.areaSqft })}</td>
                    <td className="p-2 text-right text-gray-700">
                      {r.costInr ? `₹${formatINR(r.costInr, t)}` : "—"}
                      {r.costPerSqftInr && (
                        <span className="text-xs text-gray-400 ml-1">
                          {t("design.perSqftShort", { rate: r.costPerSqftInr })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(brief.floors[activeFloor] as any).floorCostInr != null && (
                <tfoot className="bg-gray-50 text-sm">
                  <tr className="border-t">
                    <td colSpan={3} className="p-2 font-medium text-right">{t("design.viewer.floorTotal")}</td>
                    <td className="p-2 text-right font-medium">
                      {t("design.sqftValue", { value: brief.floors[activeFloor].netSqft })}
                    </td>
                    <td className="p-2 text-right font-bold">
                      ₹{formatINR((brief.floors[activeFloor] as any).floorCostInr, t)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {/* Narrative */}
      {narrative && (
        <section>
          <h2 className="text-xl font-bold mb-3">{t("design.viewer.brief")}</h2>
          <div className="bg-white border rounded-lg p-6 prose prose-sm max-w-none whitespace-pre-wrap">
            {narrative.split(/\r?\n/).map((line, i) =>
              line.startsWith("## ") ? (
                <h3 key={i} className="font-semibold text-base mt-2">{line.slice(3)}</h3>
              ) : (
                <div key={i}>{line}</div>
              )
            )}
          </div>
        </section>
      )}

      {/* Materials / MEP / Code */}
      <section className="grid md:grid-cols-3 gap-4">
        <ListCard title={t("design.viewer.materials")} items={brief.materials} />
        <ListCard title={t("design.viewer.mep")} items={brief.mep} />
        <ListCard title={t("design.viewer.codeNotes")} items={brief.codeNotes} />
      </section>
    </div>
  );
}

function formatINR(n: number, t: ReturnType<typeof useT>): string {
  if (n >= 10_000_000) return t("design.amount.crore", { value: (n / 10_000_000).toFixed(2) });
  if (n >= 100_000) return t("design.amount.lakh", { value: (n / 100_000).toFixed(1) });
  if (n >= 1_000) return t("design.amount.thousand", { value: (n / 1_000).toFixed(0) });
  return String(n);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <ul className="text-sm space-y-1 list-disc pl-5 text-gray-700">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
