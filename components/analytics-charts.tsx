"use client";
/**
 * Daily activity chart for /dashboard/analytics.
 *
 * Migrated from raw Recharts to `tekivex-ui/charts` in Round 7. The Tkx chart
 * is a declarative wrapper around Recharts (so the underlying renderer is the
 * same), but exercises the new split-entry-point dist + .d.ts shims tekivex-ui
 * cleaned up in 3.18.1 — confirming those landed cleanly in our toolchain.
 *
 * If TkxLineChart ever lacks a feature we need, fallback is `import { LineChart } from "recharts"`.
 */
import { TkxLineChart, type TkxLineChartProps } from "tekivex-ui/charts";

// TkxLineChartSeries IS exported in the source but not re-exported from
// tekivex-ui/charts/index — filed upstream as tekivex-ui#32. Derive it from
// TkxLineChartProps until that lands.
type TkxLineChartSeries = TkxLineChartProps["series"][number];

const COLORS = ["#0f766e", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

type Point = Record<string, string | number>;

export function AnalyticsCharts({ series: data }: { series: Point[] }) {
  // Discover the numeric series keys (everything except the x-axis "day").
  const keys = Array.from(
    new Set(data.flatMap((p) => Object.keys(p).filter((k) => k !== "day")))
  );

  if (data.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-sm text-gray-500">
        No activity in the last 30 days.
      </div>
    );
  }

  const chartSeries: TkxLineChartSeries[] = keys.map((k, i) => ({
    key: k,
    label: k,
    color: COLORS[i % COLORS.length],
    strokeWidth: 2,
    dot: false,
  }));

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-3">Daily activity</h3>
      <TkxLineChart
        data={data}
        series={chartSeries}
        xKey="day"
        height={320}
        smooth
        showGrid
        showLegend
        showTooltip
        ariaLabel="Daily activity over the last 30 days"
      />
    </div>
  );
}
