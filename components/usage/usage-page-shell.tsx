"use client";
import { ReactNode } from "react";
import { TkxCard, TkxCardHeader, TkxCardBody, TkxStatistic, TkxAlert, TkxBadge } from "@/components/tkx-dyn";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatInr, formatNumber } from "@/lib/i18n/format";

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
  const t = useT();
  const locale = useLocale();
  const overCap = headlineKpis.designsUsed >= headlineKpis.designsCap;
  const [deeplinkBefore, deeplinkAfter] = t("account.usage.autoWhatsappBody").split("{deeplink}");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader
          title={<span style={{ fontSize: 22, fontWeight: 700 }}>{t("account.usage.title")}</span>}
          subtitle={
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {t("account.usage.plan")} <TkxBadge variant={priceInr === 0 ? "default" : "primary"} size="sm" outlined>{planLabel}</TkxBadge>{" "}
              · {priceInr === 0 ? t("common.free") : t("account.billing.perMonth", { price: formatInr(priceInr, locale) })}
              {renewsOn && <> · {t("account.usage.renews", { date: renewsOn })}</>}
            </span>
          }
          action={manageSubscription}
        />
      </TkxCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <KpiCard
          title={t("account.usage.spendMtd")}
          value={`$${(headlineKpis.spendCents / 100).toFixed(2)}`}
          suffix={<span style={{ fontSize: 11, color: "#6b7280" }}>{t("account.usage.projected", { amount: `$${(headlineKpis.projectedSpendCents / 100).toFixed(2)}` })}</span>}
        />
        <KpiCard
          title={t("account.usage.savingsMtd")}
          value={`~$${(headlineKpis.savedCents / 100).toFixed(2)}`}
          trend="up"
          trendValue={t("account.usage.hits", { count: headlineKpis.cacheHitCount })}
        />
        <KpiCard
          title={t("account.usage.designsUsed")}
          value={`${headlineKpis.designsUsed} / ${formatNumber(headlineKpis.designsCap, locale)}`}
          trend={overCap ? "down" : undefined}
          trendValue={overCap ? t("account.usage.capReached") : undefined}
        />
        <KpiCard
          title={t("account.usage.leadAlerts")}
          value={`${headlineKpis.leadAlerts} / ${formatNumber(headlineKpis.leadAlertsCap, locale)}`}
        />
      </div>

      <TkxCard variant="outlined" padding="none">
        <TkxCardHeader title={t("account.usage.breakdown")} />
        <TkxCardBody>{table}</TkxCardBody>
      </TkxCard>

      <TkxAlert variant="info" title={t("account.usage.lowBillTitle")}>
        <ul style={{ marginTop: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li><strong>{t("account.usage.cacheTerm")}</strong> — {t("account.usage.cacheBody")}</li>
          <li><strong>{t("account.usage.gatingTerm")}</strong> — {t("account.usage.gatingBody")}</li>
          <li><strong>{t("account.usage.optInTerm")}</strong> — {t("account.usage.optInBody")}</li>
          <li><strong>{t("account.usage.geoTerm")}</strong> — {t("account.usage.geoBody")}</li>
        </ul>
      </TkxAlert>

      <TkxAlert variant="info" title={t("account.usage.downgradeTitle")}>
        <ul style={{ marginTop: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>
            <strong>{t("account.usage.pastTerm")}</strong> {t("account.usage.pastBody")}
          </li>
          <li>
            <strong>{t("account.usage.newTerm")}</strong> {t("account.usage.newBody")}
          </li>
          <li>
            <strong>{t("account.usage.autoWhatsappTerm")}</strong> {deeplinkBefore}
            <em>wa.me</em>
            {deeplinkAfter}
          </li>
          <li>
            <strong>{t("account.usage.alertsTerm")}</strong> {t("account.usage.alertsBody")}
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
