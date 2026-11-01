import { format, type Locale } from "@/lib/i18n/dict";
import type { Band } from "./scoring";

/**
 * Next-best-action suggestions.
 *
 * Rules decide WHAT could be suggested. What the org's brokers actually accept
 * decides what ranks highest: each kind keeps an accepted/dismissed tally, and
 * its priority is scaled by the smoothed acceptance rate. Ignored advice sinks;
 * advice the team follows rises.
 *
 * Text is stored as `params` and rendered per viewer, so the same suggestion
 * reads correctly in English and Hindi.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** A dismissed suggestion may return after this long if still relevant. */
export const SUGGESTION_CYCLE_DAYS = 14;
const MAX_SUGGESTIONS = 8;
/** Stops one busy kind crowding every other kind of advice off the list. */
const MAX_PER_KIND = 3;

export type SuggestionKind =
  | "call_hot_lead"
  | "record_outcome"
  | "revive_warm_lead"
  | "refresh_plot"
  | "reduce_no_shows";

export type SuggestionParams = Record<string, string | number>;

export type LeadFact = {
  clientId: string;
  name: string;
  band: Band;
  score: number;
  daysSinceContact: number;
};
export type UnresolvedVisit = {
  visitId: string;
  clientName: string;
  plotTitle: string;
  daysAgo: number;
};
export type PlotFact = {
  plotId: string;
  title: string;
  daysListed: number;
  visitsLast30Days: number;
};

export type SuggestionInput = {
  leads: LeadFact[];
  unresolvedVisits: UnresolvedVisit[];
  availablePlots: PlotFact[];
  noShowRatePct: number;
  visitsLast90Days: number;
};

export type Candidate = {
  kind: SuggestionKind;
  entityId: string;
  params: SuggestionParams;
  link: string;
  priority: number;
};

export function suggestionText(kind: string, params: SuggestionParams, locale: Locale) {
  return {
    title: format(`insights.sug.${kind}.title`, locale, params),
    body: format(`insights.sug.${kind}.body`, locale, params),
  };
}

export function buildCandidates(input: SuggestionInput): Candidate[] {
  const out: Candidate[] = [];

  for (const l of input.leads) {
    const params = { name: l.name, score: l.score, days: l.daysSinceContact };
    if (l.band === "hot" && l.daysSinceContact >= 3) {
      out.push({
        kind: "call_hot_lead",
        entityId: l.clientId,
        params,
        link: `/dashboard/clients/${l.clientId}`,
        priority: 80 + Math.min(l.score - 60, 20),
      });
    } else if (l.band === "warm" && l.daysSinceContact >= 14) {
      out.push({
        kind: "revive_warm_lead",
        entityId: l.clientId,
        params,
        link: `/dashboard/clients/${l.clientId}`,
        priority: 40 + Math.min(l.score - 30, 20),
      });
    }
  }

  for (const v of input.unresolvedVisits) {
    out.push({
      kind: "record_outcome",
      entityId: v.visitId,
      params: { name: v.clientName, plot: v.plotTitle, days: v.daysAgo },
      link: `/dashboard/visits/${v.visitId}`,
      priority: 60,
    });
  }

  for (const p of input.availablePlots) {
    if (p.daysListed >= 45 && p.visitsLast30Days === 0) {
      out.push({
        kind: "refresh_plot",
        entityId: p.plotId,
        params: { plot: p.title, days: p.daysListed },
        link: `/dashboard/plots/${p.plotId}`,
        priority: 35,
      });
    }
  }

  if (input.noShowRatePct >= 25 && input.visitsLast90Days >= 8) {
    out.push({
      kind: "reduce_no_shows",
      entityId: "org",
      params: { rate: input.noShowRatePct },
      link: "/dashboard/visits",
      priority: 55,
    });
  }

  return out;
}

export type KindFeedback = Record<string, { accepted: number; dismissed: number }>;

/**
 * Smoothed acceptance rate scaled so an untried kind stays at 1.0. Two imaginary
 * accepts and dismissals stop one early click from swinging the ranking.
 */
export function feedbackMultiplier(fb?: { accepted: number; dismissed: number }): number {
  const accepted = fb?.accepted ?? 0;
  const dismissed = fb?.dismissed ?? 0;
  return ((accepted + 2) / (accepted + dismissed + 4)) * 2;
}

export function rankCandidates(candidates: Candidate[], feedback: KindFeedback): Candidate[] {
  const perKind = new Map<string, number>();
  return candidates
    .map((c) => ({ ...c, priority: Math.round(c.priority * feedbackMultiplier(feedback[c.kind])) }))
    .sort((a, b) => b.priority - a.priority)
    .filter((c) => {
      const shown = perKind.get(c.kind) ?? 0;
      perKind.set(c.kind, shown + 1);
      return shown < MAX_PER_KIND;
    })
    .slice(0, MAX_SUGGESTIONS);
}

export function dedupeKey(c: Pick<Candidate, "kind" | "entityId">, now: Date): string {
  const cycle = Math.floor(now.getTime() / (SUGGESTION_CYCLE_DAYS * DAY_MS));
  return `${c.kind}:${c.entityId}:${cycle}`;
}
