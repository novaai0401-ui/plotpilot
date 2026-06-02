"use client";
import { TkxTable, type ColumnDef } from "@/components/tkx-dyn";

export type UsageRow = {
  kind: string;
  label: string;
  units: number;
  unitLabel: string;
  cents: number;
  projectedCents: number;
};

const columns: ColumnDef<UsageRow>[] = [
  { key: "label", header: "Service", width: "35%" },
  {
    key: "units",
    header: "Used",
    render: (_v, row) => `${row.units.toLocaleString()} ${row.unitLabel}`,
  },
  {
    key: "cents",
    header: "Cost (MTD)",
    render: (v) => `$${((v as number) / 100).toFixed(3)}`,
  },
  {
    key: "projectedCents",
    header: "Projected EoM",
    render: (v) => <span style={{ color: "#6b7280" }}>${((v as number) / 100).toFixed(2)}</span>,
  },
];

export function UsageTable({ rows }: { rows: UsageRow[] }) {
  return (
    <TkxTable
      columns={columns}
      data={rows}
      striped
      compact
      bordered
      caption="Per-service usage and cost (this month)"
    />
  );
}
