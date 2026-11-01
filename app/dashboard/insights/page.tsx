import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { InsightsDashboard } from "@/components/insights/insights-dashboard";
import { getLocale } from "@/lib/i18n/server";
import { fallbackNarrative } from "@/lib/insights/metrics";
import type { PeriodKind } from "@/lib/insights/periods";
import {
  computeReport,
  getLeadModelStatus,
  getOpenSuggestions,
  getScoredLeads,
  getStoredNarrative,
  localizeSuggestion,
} from "@/lib/insights/service";

const PERIODS: PeriodKind[] = ["week", "month", "year"];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const user = await requireUser(BROKER_ROLES);
  const locale = getLocale();
  const kind = PERIODS.find((p) => p === searchParams.period) ?? "month";
  const now = new Date();

  const [metrics, stored, leads, suggestions, model, org] = await Promise.all([
    computeReport(user.orgId, kind, now),
    getStoredNarrative(user.orgId, kind, now),
    getScoredLeads(user.orgId, now),
    getOpenSuggestions(user.orgId),
    getLeadModelStatus(user.orgId),
    prisma.organization.findUnique({ where: { id: user.orgId }, select: { slug: true } }),
  ]);

  // Stored summaries are written in English; other languages use the template.
  const narrative = locale === "en" && stored ? stored.narrative : fallbackNarrative(metrics, locale);

  return (
    <InsightsDashboard
      locale={locale}
      kind={kind}
      isDemo={org?.slug === "demo-brokerage"}
      metrics={metrics}
      narrative={narrative}
      leads={leads.slice(0, 30)}
      suggestions={suggestions.map((s) => ({
        id: s.id,
        link: s.link,
        ...localizeSuggestion(s, locale),
      }))}
      model={
        model && {
          source: model.source,
          sampleCount: model.sampleCount,
          heldOutAccuracy: model.heldOutAccuracy,
          baselineAccuracy: model.baselineAccuracy,
        }
      }
    />
  );
}
