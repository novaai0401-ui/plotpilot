import { format, translate, type Locale } from "@/lib/i18n/dict";
import { bucketKey, bucketKeys, inRange, periodLabel, type DateRange, type PeriodKind } from "./periods";

/**
 * Report calculations. Pure: the caller loads rows covering both the report
 * period and the one before it, and this turns them into numbers. Nothing here
 * touches the database or an LLM, so every figure in a report is reproducible.
 */

export type EventRow = { type: string; createdAt: Date; metadata?: unknown };

export type VisitRow = {
  agentId: string;
  plotId: string;
  clientId: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  outcome: "interested" | "not_interested" | "booked" | null;
  outcomeAt: Date | null;
  scheduledAt: Date;
};

export type ActivityRow = { userId: string; path: string; createdAt: Date };

export type MetricsInput = {
  kind: PeriodKind;
  range: DateRange;
  previous: DateRange;
  events: EventRow[];
  visits: VisitRow[];
  activity: ActivityRow[];
  agentNames: Record<string, string>;
  plotTitles: Record<string, string>;
};

export type Kpi = {
  key: string;
  label: string;
  value: number;
  previous: number;
  /** Percent change from the previous period; null when previous was zero. */
  changePct: number | null;
  /** True for figures where going down is the good direction. */
  lowerIsBetter?: boolean;
  unit?: "%";
};

export type ReportMetrics = {
  kind: PeriodKind;
  label: string;
  start: string;
  end: string;
  kpis: Kpi[];
  funnel: { key: string; stage: string; count: number; ratePct: number | null }[];
  timeline: { day: string; Visits: number; Bookings: number; Messages: number }[];
  agents: { name: string; completed: number; noShows: number; bookings: number }[];
  plots: { title: string; visits: number; bookings: number }[];
  sections: { path: string; views: number }[];
  activeStaff: number;
  isEmpty: boolean;
};

function pctChange(value: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((value - previous) / previous) * 100);
}

function ratePct(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

/**
 * Conversion between two funnel stages. Stages are counted across the period,
 * so a later stage can exceed an earlier one (one client, three visits). Such a
 * figure isn't a conversion rate, so it's left out rather than shown as "277%".
 */
function stageRate(part: number, whole: number): number | null {
  const rate = ratePct(part, whole);
  return rate !== null && rate <= 100 ? rate : null;
}

function deeplinkMessage(e: EventRow): boolean {
  return (e.metadata as { channel?: string } | null | undefined)?.channel === "whatsapp_deeplink";
}

type PeriodCounts = {
  invitesSent: number;
  clientsJoined: number;
  visitsHeld: number;
  noShows: number;
  bookings: number;
  messagesSent: number;
  messagesPrepared: number;
  inquiries: number;
  designs: number;
};

function countPeriod(input: MetricsInput, range: DateRange): PeriodCounts {
  const events = input.events.filter((e) => inRange(e.createdAt, range));
  const ofType = (t: string) => events.filter((e) => e.type === t);
  const visits = input.visits.filter((v) => inRange(v.scheduledAt, range));
  const sent = ofType("message.sent");
  return {
    invitesSent: ofType("invitation.sent").length,
    clientsJoined: ofType("invitation.accepted").length,
    visitsHeld: visits.filter((v) => v.status === "completed").length,
    noShows: visits.filter((v) => v.status === "no_show").length,
    bookings: input.visits.filter((v) => v.outcome === "booked" && inRange(v.outcomeAt, range)).length,
    // A wa.me deep link only opens WhatsApp; the broker may never press send.
    messagesSent: sent.filter((e) => !deeplinkMessage(e)).length,
    messagesPrepared: sent.filter(deeplinkMessage).length,
    inquiries: ofType("message.received").length,
    designs: ofType("design.generated").length,
  };
}

export function computeMetrics(input: MetricsInput): ReportMetrics {
  const { kind, range, previous } = input;
  const now = countPeriod(input, range);
  const prev = countPeriod(input, previous);

  const noShowRate = (c: PeriodCounts) => ratePct(c.noShows, c.visitsHeld + c.noShows) ?? 0;
  const kpi = (key: string, label: string, value: number, before: number, extra: Partial<Kpi> = {}): Kpi => ({
    key,
    label,
    value,
    previous: before,
    changePct: pctChange(value, before),
    ...extra,
  });

  const kpis: Kpi[] = [
    kpi("bookings", "Bookings", now.bookings, prev.bookings),
    kpi("visitsHeld", "Visits held", now.visitsHeld, prev.visitsHeld),
    kpi("noShowRate", "No-show rate", noShowRate(now), noShowRate(prev), { lowerIsBetter: true, unit: "%" }),
    kpi("invitesSent", "Clients invited", now.invitesSent, prev.invitesSent),
    kpi("clientsJoined", "Clients joined", now.clientsJoined, prev.clientsJoined),
    kpi("inquiries", "Client replies", now.inquiries, prev.inquiries),
    kpi("messagesSent", "Messages sent", now.messagesSent, prev.messagesSent),
    kpi("messagesPrepared", "WhatsApp links opened", now.messagesPrepared, prev.messagesPrepared),
    kpi("designs", "Designs generated", now.designs, prev.designs),
  ];

  const funnel = [
    { key: "invited", stage: "Invited", count: now.invitesSent, ratePct: null },
    { key: "joined", stage: "Joined", count: now.clientsJoined, ratePct: stageRate(now.clientsJoined, now.invitesSent) },
    { key: "visited", stage: "Visited", count: now.visitsHeld, ratePct: stageRate(now.visitsHeld, now.clientsJoined) },
    { key: "booked", stage: "Booked", count: now.bookings, ratePct: stageRate(now.bookings, now.visitsHeld) },
  ];

  const buckets = new Map(
    bucketKeys(kind, range).map((day) => [day, { day, Visits: 0, Bookings: 0, Messages: 0 }])
  );
  for (const v of input.visits) {
    if (v.status === "completed" && inRange(v.scheduledAt, range)) {
      const b = buckets.get(bucketKey(kind, v.scheduledAt));
      if (b) b.Visits++;
    }
    if (v.outcome === "booked" && inRange(v.outcomeAt, range)) {
      const b = buckets.get(bucketKey(kind, v.outcomeAt!));
      if (b) b.Bookings++;
    }
  }
  for (const e of input.events) {
    if (e.type === "message.sent" && inRange(e.createdAt, range)) {
      const b = buckets.get(bucketKey(kind, e.createdAt));
      if (b) b.Messages++;
    }
  }

  const agentMap = new Map<string, { name: string; completed: number; noShows: number; bookings: number }>();
  const plotMap = new Map<string, { title: string; visits: number; bookings: number }>();
  const agentOf = (id: string) => {
    if (!agentMap.has(id)) {
      agentMap.set(id, { name: input.agentNames[id] || "Unknown", completed: 0, noShows: 0, bookings: 0 });
    }
    return agentMap.get(id)!;
  };
  const plotOf = (id: string) => {
    if (!plotMap.has(id)) {
      plotMap.set(id, { title: input.plotTitles[id] || "Unknown plot", visits: 0, bookings: 0 });
    }
    return plotMap.get(id)!;
  };
  for (const v of input.visits) {
    if (inRange(v.scheduledAt, range)) {
      if (v.status === "completed") {
        agentOf(v.agentId).completed++;
        plotOf(v.plotId).visits++;
      }
      if (v.status === "no_show") agentOf(v.agentId).noShows++;
    }
    if (v.outcome === "booked" && inRange(v.outcomeAt, range)) {
      agentOf(v.agentId).bookings++;
      plotOf(v.plotId).bookings++;
    }
  }

  const activity = input.activity.filter((a) => inRange(a.createdAt, range));
  const sectionViews = new Map<string, number>();
  for (const a of activity) sectionViews.set(a.path, (sectionViews.get(a.path) || 0) + 1);

  return {
    kind,
    label: periodLabel(kind, range),
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    kpis,
    funnel,
    timeline: Array.from(buckets.values()),
    agents: Array.from(agentMap.values()).sort((a, b) => b.bookings - a.bookings || b.completed - a.completed),
    plots: Array.from(plotMap.values())
      .sort((a, b) => b.bookings - a.bookings || b.visits - a.visits)
      .slice(0, 5),
    sections: Array.from(sectionViews, ([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5),
    activeStaff: new Set(activity.map((a) => a.userId)).size,
    isEmpty: Object.values(now).every((n) => n === 0),
  };
}

/** Written summary used when no LLM is available. Every clause comes from `m`. */
export function fallbackNarrative(m: ReportMetrics, locale: Locale = "en"): string {
  const label = periodLabel(m.kind, { start: new Date(m.start), end: new Date(m.end) }, locale);
  if (m.isEmpty) return format("insights.narr.empty", locale, { label });
  const find = (key: string) => m.kpis.find((k) => k.key === key)!;
  const delta = (k: Kpi) => {
    if (k.changePct === null) return "";
    if (k.changePct === 0) return translate("insights.narr.same", locale);
    const direction = k.changePct > 0 ? "up" : "down";
    return format(`insights.narr.${direction}`, locale, { change: Math.abs(k.changePct) });
  };

  const bookings = find("bookings");
  const visits = find("visitsHeld");
  const noShow = find("noShowRate");
  const word = (name: string, n: number) => translate(`insights.narr.${name}.${n === 1 ? "one" : "other"}`, locale);
  const lines = [
    format("insights.narr.headline", locale, {
      label,
      bookings: bookings.value,
      bookingWord: word("booking", bookings.value),
      bookingDelta: delta(bookings),
      visits: visits.value,
      visitWord: word("visit", visits.value),
      visitDelta: delta(visits),
    }),
  ];
  if (noShow.value > 0) lines.push(format("insights.narr.noShow", locale, { rate: noShow.value }));
  if (m.plots[0]) {
    lines.push(format("insights.narr.topPlot", locale, { plot: m.plots[0].title, visits: m.plots[0].visits }));
  }
  if (m.agents[0]?.bookings) {
    lines.push(format("insights.narr.topAgent", locale, { name: m.agents[0].name, bookings: m.agents[0].bookings }));
  }
  return lines.join(" ");
}
