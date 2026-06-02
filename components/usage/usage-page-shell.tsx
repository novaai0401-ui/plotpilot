"use client";
import { ReactNode } from "react";
import { TkxCard, TkxCardHeader, TkxCardBody, TkxStatistic, TkxAlert, TkxBadge } from "@/components/tkx-dyn";

type Kpis = {
  spendCents: number;
  projectedSpendCents: number;
  savedCents: number;
  cacheHitCount: number;
  designsUsed: number;
  designsCap: number;
  leadAlerts: number;
  leadAlertsCap: number;
};

export function UsagePageShell({
  planLabel,
  priceInr,
  renewsOn,
  headlineKpis,
  manageSubscription,
  table,
}: {
  planLabel: string;
  priceInr: number;
  renewsOn: string | null;
  headlineKpis: Kpis;
  manageSubscription: ReactNode;
  table: ReactNode;
}) {
  const overCap = headlineKpis.designsUsed >= headlineKpis.designsCap;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader
          title={<span style={{ fontSize: 22, fontWeight: 700 }}>Usage &amp; billing</span>}
          subtitle={
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              Plan: <TkxBadge variant={priceInr === 0 ? "default" : "primary"} size="sm" outlined>{planLabel}</TkxBadge>{" "}
              · {priceInr === 0 ? "Free" : `₹${priceInr.toLocaleString("en-IN")}/month`}
              {renewsOn && <> · renews {renewsOn}</>}
            </span>
          }
          action={manageSubscription}
        />
      </TkxCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <KpiCard
          title="Spend MTD"
          value={`$${(headlineKpis.spendCents / 100).toFixed(2)}`}
          suffix={<span style={{ fontSize: 11, color: "#6b7280" }}>proj ${(headlineKpis.projectedSpendCents / 100).toFixed(2)}</span>}
        />
        <KpiCard
          title="Cache savings MTD"
          value={`~$${headlineKpis.savedCents.toFixed(2)}`}
          trend="up"
          trendValue={`${headlineKpis.cacheHitCount} hits`}
        />
        <KpiCard
          title="Designs used"
          value={`${headlineKpis.designsUsed} / ${headlineKpis.designsCap.toLocaleString()}`}
          trend={overCap ? "down" : undefined}
          trendValue={overCap ? "cap reached" : undefined}
        />
        <KpiCard
          title="Lead alerts"
          value={`${headlineKpis.leadAlerts} / ${headlineKpis.leadAlertsCap.toLocaleString()}`}
        />
      </div>

      <TkxCard variant="outlined" padding="none">
        <TkxCardHeader title="Per-service breakdown (this month)" />
        <TkxCardBody>{table}</TkxCardBody>
      </TkxCard>

      <TkxAlert variant="info" title="How we keep your bill low">
        <ul style={{ marginTop: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li><strong>Cache</strong> — identical design requirements within 30 days reuse the previous AI output (zero cost on cache hit).</li>
          <li><strong>Plan gating</strong> — free plan uses our deterministic rules engine only; AI features unlock on Pro+.</li>
          <li><strong>Channel opt-ins</strong> — WhatsApp Business API sends are off by default. In-app + email are free at your volume.</li>
          <li><strong>Geo routing</strong> — public-lead alerts only fire for orgs in the lead's service area.</li>
        </ul>
      </TkxAlert>

      <TkxAlert variant="info" title="What happens if I downgrade?">
        <ul style={{ marginTop: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>
            <strong>Past designs are yours forever.</strong> Anything you've already generated stays
            viewable and downloadable (PDF, DXF) regardless of plan changes.
          </li>
          <li>
            <strong>New design generation</strong> follows the new plan's cap and feature set
            starting from the moment of downgrade.
          </li>
          <li>
            <strong>WhatsApp Business API sends</strong> automatically pause if your new plan
            doesn't include them. We fall back to <em>wa.me</em> deeplinks so you can still message
            clients manually. Your stored credentials remain encrypted on file — re-upgrade and
            they're live again instantly.
          </li>
          <li>
            <strong>Lead alerts</strong> respect the new monthly cap. In-app + email continue;
            WhatsApp alerts pause if downgraded out of the Enterprise tier.
          </li>
        </ul>
      </TkxAlert>
    </div>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendValue,
  suffix,
}: {
  title: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  suffix?: ReactNode;
}) {
  return (
    <TkxCard variant="elevated" padding="md" isHoverable>
      <TkxStatistic title={title} value={value} trend={trend} trendValue={trendValue} suffix={suffix as any} />
    </TkxCard>
  );
}
