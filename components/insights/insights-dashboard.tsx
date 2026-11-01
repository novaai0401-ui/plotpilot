"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnalyticsCharts } from "@/components/analytics-charts";
import {
  TkxAlert,
  TkxAvatar,
  TkxBadge,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxEmpty,
  TkxGauge,
  TkxProgress,
  TkxSegmented,
  TkxSparkline,
  TkxStatistic,
  TkxTable,
  type ColumnDef,
} from "@/components/tkx-dyn";
import { format, translate, type Locale } from "@/lib/i18n/dict";
import type { Kpi, ReportMetrics } from "@/lib/insights/metrics";
import { periodLabel, type PeriodKind } from "@/lib/insights/periods";
import { MIN_SAMPLES_TO_TRAIN, type Band } from "@/lib/insights/scoring";
import { AskPanel } from "./ask-panel";
import { SuggestionList, type SuggestionItem } from "./suggestion-list";

type Lead = {
  clientId: string;
  name: string;
  score: number;
  band: Band;
  reasons: string[];
  daysSinceContact: number;
};

type ModelStatus = {
  source: string;
  sampleCount: number;
  heldOutAccuracy: number | null;
  baselineAccuracy: number | null;
} | null;

const BAND_VARIANT = { hot: "danger", warm: "warning", cold: "default" } as const;
const SCORE_COLORS = [
  { at: 0, color: "#9ca3af" },
  { at: 30, color: "#f59e0b" },
  { at: 60, color: "#dc2626" },
];
const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "nav.overview",
  "/dashboard/clients": "nav.clients",
  "/dashboard/visits": "nav.visits",
  "/dashboard/plots": "nav.plots",
  "/dashboard/insights": "nav.insights",
};

const section = { display: "flex", flexDirection: "column", gap: 20 } as const;
const twoColumns = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 } as const;

export function InsightsDashboard({
  locale,
  kind,
  isDemo,
  metrics,
  narrative,
  leads,
  suggestions,
  model,
}: {
  locale: Locale;
  kind: PeriodKind;
  isDemo: boolean;
  metrics: ReportMetrics;
  narrative: string;
  leads: Lead[];
  suggestions: SuggestionItem[];
  model: ModelStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tr = (key: string) => translate(key, locale);
  const label = periodLabel(kind, { start: new Date(metrics.start), end: new Date(metrics.end) }, locale);

  return (
    <div style={{ ...section, maxWidth: 1080, opacity: pending ? 0.6 : 1, transition: "opacity 150ms" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 className="text-2xl font-bold">{tr("insights.title")}</h1>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
        <div aria-label={tr("insights.periodNav")}>
          <TkxSegmented
            value={kind}
            options={(["week", "month", "year"] as const).map((p) => ({ value: p, label: tr(`insights.period.${p}`) }))}
            onChange={(p) => startTransition(() => router.push(`/dashboard/insights?period=${p}`))}
          />
        </div>
      </div>

      {isDemo && <TkxAlert variant="info">{tr("insights.demoNotice")}</TkxAlert>}

      <TkxCard variant="elevated" padding="md">
        <TkxCardHeader title={tr("insights.summary")} />
        <TkxCardBody>
          <p className="text-base text-gray-700 whitespace-pre-line">{narrative}</p>
        </TkxCardBody>
      </TkxCard>

      <AskPanel key={locale} period={kind} locale={locale} />

      <section
        aria-label={tr("insights.keyFigures")}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}
      >
        {metrics.kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} locale={locale} trend={sparkline(metrics, k.key)} />
        ))}
      </section>

      <div style={twoColumns}>
        <TkxCard padding="md">
          <TkxCardHeader title={tr("insights.nextSteps")} />
          <TkxCardBody>
            <SuggestionList key={locale} suggestions={suggestions} locale={locale} />
          </TkxCardBody>
        </TkxCard>
        <LeadScores leads={leads} model={model} locale={locale} />
      </div>

      <TkxCard padding="md">
        <TkxCardHeader title={tr("insights.funnel")} subtitle={tr("insights.funnelNote")} />
        <TkxCardBody>
          <Funnel metrics={metrics} locale={locale} />
        </TkxCardBody>
      </TkxCard>

      <AnalyticsCharts
        series={metrics.timeline}
        title={tr("insights.trend")}
        emptyText={tr("insights.noActivity")}
        seriesLabels={{
          Visits: tr("insights.chart.visits"),
          Bookings: tr("insights.chart.bookings"),
          Messages: tr("insights.chart.messages"),
        }}
      />

      <div style={twoColumns}>
        <RankedTable
          title={tr("insights.team")}
          empty={tr("insights.noTeam")}
          rows={metrics.agents as unknown as Row[]}
          columns={[
            { key: "name", header: tr("insights.col.agent") },
            { key: "completed", header: tr("insights.col.visits") },
            { key: "noShows", header: tr("insights.col.noShows") },
            { key: "bookings", header: tr("insights.col.booked") },
          ]}
        />
        <RankedTable
          title={tr("insights.topPlots")}
          empty={tr("insights.noPlots")}
          rows={metrics.plots as unknown as Row[]}
          columns={[
            { key: "title", header: tr("insights.col.plot") },
            { key: "visits", header: tr("insights.col.visits") },
            { key: "bookings", header: tr("insights.col.booked") },
          ]}
        />
      </div>

      {metrics.sections.length > 0 && (
        <RankedTable
          title={format("insights.sections", locale, { count: metrics.activeStaff })}
          empty=""
          rows={metrics.sections.map((s) => ({
            section: SECTION_LABELS[s.path] ? tr(SECTION_LABELS[s.path]) : s.path,
            views: s.views,
          }))}
          columns={[
            { key: "section", header: tr("insights.col.section") },
            { key: "views", header: tr("insights.col.views") },
          ]}
        />
      )}
    </div>
  );
}

/** Daily or monthly shape behind the two headline figures. */
function sparkline(metrics: ReportMetrics, key: string): number[] | undefined {
  if (key === "bookings") return metrics.timeline.map((d) => d.Bookings);
  if (key === "visitsHeld") return metrics.timeline.map((d) => d.Visits);
  return undefined;
}

function KpiCard({ kpi, locale, trend }: { kpi: Kpi; locale: Locale; trend?: number[] }) {
  const change = kpi.changePct;
  const changeText =
    change === null
      ? format("insights.was", locale, { value: `${kpi.previous}${kpi.unit ?? ""}` })
      : format("insights.vsPrevious", locale, { change: `${change > 0 ? "+" : ""}${change}` });

  // An up arrow on no-show rate would read as good news, so leave it off.
  const arrow = kpi.lowerIsBetter || !change ? undefined : change > 0 ? "up" : "down";

  return (
    <TkxCard padding="sm">
      <TkxCardBody>
        <TkxStatistic
          title={translate(`insights.kpi.${kpi.key}`, locale)}
          value={`${kpi.value}${kpi.unit ?? ""}`}
          trend={arrow}
          trendValue={changeText}
        />
        {!arrow && <div className="text-xs text-gray-500">{changeText}</div>}
        {trend && trend.some((n) => n > 0) && (
          <div style={{ marginTop: 8 }}>
            <TkxSparkline data={trend} width={120} height={24} ariaLabel={translate(`insights.kpi.${kpi.key}`, locale)} />
          </div>
        )}
      </TkxCardBody>
    </TkxCard>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("");
}

function LeadScores({ leads, model, locale }: { leads: Lead[]; model: ModelStatus; locale: Locale }) {
  const [filter, setFilter] = useState<"all" | Band>("all");
  const tr = (key: string) => translate(key, locale);
  const shown = useMemo(
    () => leads.filter((l) => filter === "all" || l.band === filter).slice(0, 6),
    [leads, filter]
  );

  return (
    <TkxCard padding="md">
      <TkxCardHeader
        title={tr("insights.leadScores")}
        action={
          <TkxSegmented
            size="sm"
            value={filter}
            onChange={(v) => setFilter(v as "all" | Band)}
            options={[
              { value: "all", label: tr("insights.filter.all") },
              { value: "hot", label: tr("insights.band.hot") },
              { value: "warm", label: tr("insights.band.warm") },
            ]}
          />
        }
      />
      <TkxCardBody>
        {shown.length === 0 ? (
          <TkxEmpty description={tr("insights.noLeads")} />
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((l) => (
              <li key={l.clientId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <TkxAvatar alt={l.name} initials={initials(l.name)} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/dashboard/clients/${l.clientId}`} className="text-sm font-medium hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-xs text-gray-500">{l.reasons.map((r) => tr(r)).join(" · ")}</div>
                </div>
                <TkxBadge variant={BAND_VARIANT[l.band]} size="sm">{tr(`insights.band.${l.band}`)}</TkxBadge>
                <TkxGauge
                  value={l.score}
                  size={52}
                  thickness={6}
                  thresholds={SCORE_COLORS}
                  ariaLabel={format("insights.scoreAria", locale, { score: l.score })}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500" style={{ marginTop: 12 }}>
          <ModelNote model={model} locale={locale} />
        </p>
      </TkxCardBody>
    </TkxCard>
  );
}

function ModelNote({ model, locale }: { model: ModelStatus; locale: Locale }) {
  if (model?.source !== "trained") {
    return <>{format("insights.modelStarter", locale, { needed: MIN_SAMPLES_TO_TRAIN, count: model?.sampleCount ?? 0 })}</>;
  }
  const trained = format("insights.modelTrained", locale, { count: model.sampleCount });
  if (model.heldOutAccuracy === null || model.baselineAccuracy === null) return <>{trained}</>;
  const accuracy = format("insights.modelAccuracy", locale, {
    accuracy: Math.round(model.heldOutAccuracy * 100),
    baseline: Math.round(model.baselineAccuracy * 100),
  });
  return <>{`${trained} ${accuracy}`}</>;
}

function Funnel({ metrics, locale }: { metrics: ReportMetrics; locale: Locale }) {
  const widest = Math.max(1, ...metrics.funnel.map((s) => s.count));
  return (
    <ol style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {metrics.funnel.map((s) => (
        <li key={s.key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{translate(`insights.stage.${s.key}`, locale)}</span>
            <span className="text-gray-600">
              {s.count}
              {s.ratePct !== null && ` · ${format("insights.funnelRate", locale, { rate: s.ratePct })}`}
            </span>
          </div>
          <TkxProgress value={Math.round((s.count / widest) * 100)} aria-hidden />
        </li>
      ))}
    </ol>
  );
}

type Row = Record<string, string | number>;

function RankedTable({
  title,
  columns,
  rows,
  empty,
}: {
  title: string;
  columns: ColumnDef<Row>[];
  rows: Row[];
  empty: string;
}) {
  return (
    <TkxCard padding="md">
      <TkxCardHeader title={title} />
      <TkxCardBody>
        {rows.length === 0 ? (
          <TkxEmpty description={empty} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <TkxTable columns={columns} data={rows} striped compact />
          </div>
        )}
      </TkxCardBody>
    </TkxCard>
  );
}
