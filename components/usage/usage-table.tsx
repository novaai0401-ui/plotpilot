"use client";
import { TkxTable, type ColumnDef } from "@/components/tkx-dyn";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";

export type UsageRow = {
  kind: string;
  label: string;
  units: number;
  unitLabel: string;
  cents: number;
  projectedCents: number;
};

export function UsageTable({ rows }: { rows: UsageRow[] }) {
  const t = useT();
  const locale = useLocale();
  const columns: ColumnDef<UsageRow>[] = [
    { key: "label", header: t("account.usage.colService"), width: "35%" },
    {
      key: "units",
      header: t("account.usage.colUsed"),
      render: (_v, row) => `${formatNumber(row.units, locale)} ${row.unitLabel}`,
    },
    {
      key: "cents",
      header: t("account.usage.colCost"),
      render: (v) => `$${((v as number) / 100).toFixed(3)}`,
    },
    {
      key: "projectedCents",
      header: t("account.usage.colProjected"),
      render: (v) => <span style={{ color: "#6b7280" }}>${((v as number) / 100).toFixed(2)}</span>,
    },
  ];

  return (
    <TkxTable
      columns={columns}
      data={rows}
      striped
      compact
      bordered
      caption={t("account.usage.tableCaption")}
    />
  );
}
