"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Three.js is heavy and only loaded when the user clicks the 3D tab
const Building3DViewer = dynamic(
  () => import("./building-3d-viewer").then((m) => m.Building3DViewer),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-gray-500">Loading 3D viewer…</div> }
);

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
  const [activeFloor, setActiveFloor] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const current = floorPlansSvg.find((f) => f.floor === activeFloor) || floorPlansSvg[0];

  return (
    <div className="space-y-8">
      {/* Action bar: exports */}
      {designId && (
        <div className="flex flex-wrap items-start justify-end gap-3">
          <div className="text-right text-xs text-gray-500 max-w-xs">
            <div className="font-medium text-gray-700 mb-0.5">Two export formats:</div>
            <div>
              <strong>PDF</strong> — for clients, prospects, sharing. Includes brief + floor plans + cost estimate.
            </div>
            <div className="mt-0.5">
              <strong>DXF</strong> — for architects/engineers. Open standard, imports cleanly into AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD.{" "}
              <span className="text-gray-400">
                <em>Not native <code>.dwg</code></em>
                {" "}
                <a
                  href="https://en.wikipedia.org/wiki/AutoCAD_DXF"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                  title="DXF is Autodesk's open interchange format. Every modern CAD tool accepts it; .dwg is the proprietary AutoCAD binary."
                >
                  what's the difference?
                </a>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={`/api/architect/export/${designId}/pdf`}
              className="px-4 py-2 text-sm border rounded bg-white hover:bg-gray-50 font-medium whitespace-nowrap"
            >
              ⬇ Download PDF
            </a>
            <a
              href={`/api/architect/export/${designId}/dxf`}
              className="px-4 py-2 text-sm border rounded bg-white hover:bg-gray-50 font-medium whitespace-nowrap"
              title="Open in AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD. DXF is the open AutoCAD interchange format — not native .dwg."
            >
              ⬇ Download DXF <span className="text-gray-400">(.dxf)</span>
            </a>
            <button
              type="button"
              disabled
              title="Native .dwg export is not currently enabled. Use DXF — every modern CAD tool opens it. If you specifically require .dwg, contact your account manager."
              className="px-4 py-2 text-sm border rounded bg-gray-50 text-gray-400 font-medium whitespace-nowrap cursor-not-allowed flex items-center gap-1.5"
            >
              ⬇ Download DWG
              <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                enterprise
              </span>
            </button>
          </div>
        </div>
      )}

      {/* AI render image hero */}
      {renderImageUrl && (
        <section>
          <h2 className="text-xl font-bold mb-3">Concept render</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="relative">
              <img src={renderImageUrl} alt="AI-generated concept render" className="w-full h-auto" />
              <span className="absolute top-2 left-2 bg-amber-100 text-amber-900 text-xs font-semibold px-2 py-1 rounded border border-amber-300 shadow-sm">
                AI illustration · not measured
              </span>
            </div>
            <p className="text-xs text-gray-600 p-3 border-t bg-gray-50">
              <strong>⚠ Important:</strong> this is an AI-generated mood image. Dimensions, proportions, materials,
              and layout may differ from the floor plans below. Use the 2D plans, room schedule, and DXF export
              for any measurements or contractor briefs. Treat this image as inspiration only.
            </p>
          </div>
        </section>
      )}

      {/* Summary KPIs */}
      <section>
        <h2 className="text-xl font-bold mb-3">Design summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Plot area" value={`${brief.summary.totalSqftPlot} sqft`} />
          <Kpi label="Built-up planned" value={`${brief.summary.plannedBuiltUpSqft} sqft`} />
          <Kpi label="FAR used" value={`${brief.summary.farUsedPct}%`} />
          <Kpi label="Footprint" value={`${brief.summary.footprintWidthFt}' × ${brief.summary.footprintDepthFt}'`} />
          {brief.costEstimateInr && (
            <Kpi
              label="Est. cost"
              value={`₹${(brief.costEstimateInr.low / 100000).toFixed(0)}L – ${(brief.costEstimateInr.high / 100000).toFixed(0)}L`}
              hint={`@ ₹${brief.costEstimateInr.perSqftInr}/sqft`}
            />
          )}
        </div>
        {brief.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm space-y-1">
            <strong>⚠ Warnings:</strong>
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
          <h2 className="text-xl font-bold">Floor plans</h2>
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
              <div dangerouslySetInnerHTML={{ __html: current?.svg || "" }} />
            </div>
          </div>
        )}

        {/* Room list for active floor (only in 2D view) */}
        {view === "2d" && brief.floors[activeFloor] && (
          <div className="mt-3 bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="p-2 text-left">Room</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-right">W × D</th>
                  <th className="p-2 text-right">Area</th>
                  <th className="p-2 text-right">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {brief.floors[activeFloor].rooms.map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-gray-500 text-xs">{r.type}</td>
                    <td className="p-2 text-right">{r.widthFt}' × {r.depthFt}'</td>
                    <td className="p-2 text-right">{r.areaSqft} sqft</td>
                    <td className="p-2 text-right text-gray-700">
                      {r.costInr ? formatINR(r.costInr) : "—"}
                      {r.costPerSqftInr && (
                        <span className="text-xs text-gray-400 ml-1">
                          (₹{r.costPerSqftInr}/sf)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(brief.floors[activeFloor] as any).floorCostInr != null && (
                <tfoot className="bg-gray-50 text-sm">
                  <tr className="border-t">
                    <td colSpan={3} className="p-2 font-medium text-right">Floor total</td>
                    <td className="p-2 text-right font-medium">
                      {brief.floors[activeFloor].netSqft} sqft
                    </td>
                    <td className="p-2 text-right font-bold">
                      ₹{formatINR((brief.floors[activeFloor] as any).floorCostInr)}
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
          <h2 className="text-xl font-bold mb-3">Design brief</h2>
          <div className="bg-white border rounded-lg p-6 prose prose-sm max-w-none whitespace-pre-wrap">
            {narrative}
          </div>
        </section>
      )}

      {/* Materials / MEP / Code */}
      <section className="grid md:grid-cols-3 gap-4">
        <ListCard title="Materials" items={brief.materials} />
        <ListCard title="MEP recommendations" items={brief.mep} />
        <ListCard title="Code & compliance notes" items={brief.codeNotes} />
      </section>
    </div>
  );
}

function formatINR(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
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
