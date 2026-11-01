import { prisma } from "@/lib/db/prisma";
import type { Locale } from "@/lib/i18n/dict";
import { runLlm } from "@/lib/llm/client";
import { sendEmail } from "@/lib/email/resend";
import {
  ASK_SYSTEM_PROMPT,
  buildAskMessage,
  fallbackAnswer,
  pseudonymize,
  type HotLead,
  type InsightFacts,
} from "./ask";
import { buildIntentModel, classifyIntent, detectLanguage, type Topic } from "./intent-model";
import { computeMetrics, fallbackNarrative, type ReportMetrics, type VisitRow } from "./metrics";
import { latestCompletedRange, previousRange, type PeriodKind } from "./periods";
import {
  buildSamples,
  extractFeatures,
  isClosed,
  lastContactAt,
  parseWeights,
  PRIOR_WEIGHTS,
  scoreFeatures,
  trainLeadModel,
  type ActivityVisit,
  type ClientActivity,
  type LeadScore,
  type TrainedModel,
} from "./scoring";
import {
  buildCandidates,
  dedupeKey,
  rankCandidates,
  SUGGESTION_CYCLE_DAYS,
  suggestionText,
  type KindFeedback,
  type SuggestionParams,
} from "./suggestions";

/**
 * Database side of AI insights. The calculations live in the pure modules next
 * to this file; everything here loads rows, stores results, or calls the LLM.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LEAD_SCORE_MODEL = "lead_score";
const REPORT_EVENT_TYPES = [
  "invitation.sent",
  "invitation.accepted",
  "message.sent",
  "message.received",
  "design.generated",
];
/** Enough history to train on, without loading a long-lived org's entire inbox. */
const MESSAGE_HISTORY_DAYS = 3 * 365;
const STAFF_ACTIVITY_RETENTION_DAYS = 180;

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function computeReport(orgId: string, kind: PeriodKind, now: Date): Promise<ReportMetrics> {
  const range = latestCompletedRange(kind, now);
  const previous = previousRange(kind, range);
  const span = { gte: previous.start, lt: range.end };

  const [events, visits, activity, agents, plots] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { orgId, createdAt: span, type: { in: REPORT_EVENT_TYPES } },
      select: { type: true, createdAt: true, metadata: true },
    }),
    prisma.visit.findMany({
      where: { orgId, OR: [{ scheduledAt: span }, { outcomeAt: span }] },
      select: {
        agentId: true,
        plotId: true,
        clientId: true,
        status: true,
        outcome: true,
        outcomeAt: true,
        scheduledAt: true,
      },
    }),
    prisma.staffActivity.findMany({
      where: { orgId, createdAt: { gte: range.start, lt: range.end } },
      select: { userId: true, path: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { orgId, role: { in: ["broker_admin", "broker_agent"] } },
      select: { id: true, name: true },
    }),
    prisma.plot.findMany({ where: { orgId }, select: { id: true, title: true } }),
  ]);

  return computeMetrics({
    kind,
    range,
    previous,
    events,
    visits: visits as VisitRow[],
    activity,
    agentNames: Object.fromEntries(agents.map((a) => [a.id, a.name])),
    plotTitles: Object.fromEntries(plots.map((p) => [p.id, p.title])),
  });
}

const REPORT_SYSTEM_PROMPT = `You write a short performance summary for the owner of a real-estate brokerage.

Rules:
- 80-140 words of plain text, no markdown.
- Use ONLY the numbers in the JSON. Never invent or estimate a figure.
- Open with the result that matters most, then what changed and why it's worth noticing.
- changePct is the change from the previous period; null means there is no comparison, so don't claim one.
- End with one concrete thing to do next, based only on these numbers.`;

async function writeNarrative(orgId: string, m: ReportMetrics): Promise<{ text: string; source: "llm" | "fallback" }> {
  // Agent names stay out of the prompt; the summary works from team-level figures.
  const { agents, sections, ...aggregate } = m;
  try {
    const result = await runLlm({
      orgId,
      kind: "insight",
      system: REPORT_SYSTEM_PROMPT,
      user: JSON.stringify(aggregate),
    });
    if (result.ok && result.text) return { text: result.text, source: "llm" };
  } catch (e) {
    // Over budget or provider trouble must not cost the org its report.
    console.warn("[insights] narrative fell back:", e instanceof Error ? e.message : e);
  }
  return { text: fallbackNarrative(m), source: "fallback" };
}

export async function getStoredNarrative(orgId: string, kind: PeriodKind, now: Date) {
  const range = latestCompletedRange(kind, now);
  const row = await prisma.insightReport.findUnique({
    where: { orgId_period_periodStart: { orgId, period: kind, periodStart: range.start } },
    select: { narrative: true, narrativeSource: true },
  });
  return row;
}

/** Create any report that's due. Idempotent: an existing period is left alone. */
export async function ensureReports(orgId: string, now: Date): Promise<number> {
  let created = 0;
  for (const kind of ["week", "month", "year"] as const) {
    const range = latestCompletedRange(kind, now);
    const existing = await prisma.insightReport.findUnique({
      where: { orgId_period_periodStart: { orgId, period: kind, periodStart: range.start } },
      select: { id: true },
    });
    if (existing) continue;

    const metrics = await computeReport(orgId, kind, now);
    if (metrics.isEmpty) continue;

    const narrative = await writeNarrative(orgId, metrics);
    await prisma.insightReport.create({
      data: {
        orgId,
        period: kind,
        periodStart: range.start,
        periodEnd: range.end,
        metrics: metrics as object,
        narrative: narrative.text,
        narrativeSource: narrative.source,
      },
    });
    created++;
    await announceReport(orgId, kind, metrics, narrative.text);
  }
  return created;
}

async function announceReport(orgId: string, kind: PeriodKind, m: ReportMetrics, narrative: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { notifyViaEmail: true },
  });
  const admins = await prisma.user.findMany({ where: { orgId, role: "broker_admin" } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `/dashboard/insights?period=${kind}`;
  const title = `Your ${kind}ly report: ${m.label}`;

  for (const u of admins) {
    await prisma.notification.create({
      data: {
        orgId,
        userId: u.id,
        type: "system_message",
        title,
        body: narrative.slice(0, 240),
        link,
        metadata: { report: kind, start: m.start, end: m.end },
      },
    });
    if (u.email && (u.notifyViaEmail ?? org?.notifyViaEmail)) {
      await sendEmail({
        to: u.email,
        subject: title,
        text: `${narrative}\n\nFull report: ${appUrl}${link}`,
        html: `<p>${escapeHtml(narrative)}</p><p><a href="${escapeHtml(appUrl + link)}">Open the full report</a></p>`,
      });
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ─── Lead scoring ─────────────────────────────────────────────────────────────

export async function loadClientActivities(orgId: string, now: Date): Promise<ClientActivity[]> {
  const [clients, visits, messages] = await Promise.all([
    prisma.user.findMany({
      where: { orgId, role: "client" },
      select: { id: true, name: true, createdAt: true, preferences: true },
    }),
    prisma.visit.findMany({
      where: { orgId },
      select: { clientId: true, status: true, outcome: true, outcomeAt: true, scheduledAt: true },
    }),
    prisma.message.findMany({
      where: { orgId, createdAt: { gte: new Date(now.getTime() - MESSAGE_HISTORY_DAYS * DAY_MS) } },
      select: { senderId: true, recipientId: true, createdAt: true },
    }),
  ]);

  const byClient = new Map<string, ClientActivity>(
    clients.map((c) => [
      c.id,
      {
        clientId: c.id,
        name: c.name,
        createdAt: c.createdAt,
        hasPreferences: c.preferences != null,
        visits: [],
        replies: [],
        outreach: [],
      },
    ])
  );
  for (const v of visits) byClient.get(v.clientId)?.visits.push(v as ActivityVisit);
  for (const m of messages) {
    byClient.get(m.senderId)?.replies.push(m.createdAt);
    byClient.get(m.recipientId)?.outreach.push(m.createdAt);
  }
  return Array.from(byClient.values());
}

export async function retrainLeadModel(orgId: string, now: Date): Promise<TrainedModel> {
  const model = trainLeadModel(buildSamples(await loadClientActivities(orgId, now), now));
  const data = {
    weights: model.weights as object,
    source: model.source,
    sampleCount: model.sampleCount,
    positiveCount: model.positiveCount,
    heldOutAccuracy: model.heldOutAccuracy,
    baselineAccuracy: model.baselineAccuracy,
    trainedAt: now,
  };
  await prisma.insightModel.upsert({
    where: { orgId_kind: { orgId, kind: LEAD_SCORE_MODEL } },
    create: { orgId, kind: LEAD_SCORE_MODEL, ...data },
    update: data,
  });
  return model;
}

export type ScoredLead = LeadScore & { clientId: string; name: string; daysSinceContact: number };

export async function getScoredLeads(orgId: string, now: Date): Promise<ScoredLead[]> {
  const [clients, modelRow] = await Promise.all([
    loadClientActivities(orgId, now),
    getLeadModelStatus(orgId),
  ]);
  const weights = modelRow ? parseWeights(modelRow.weights) : PRIOR_WEIGHTS;

  return clients
    .filter((c) => !isClosed(c))
    .map((c) => ({
      clientId: c.clientId,
      name: c.name,
      daysSinceContact: Math.floor((now.getTime() - lastContactAt(c, now).getTime()) / DAY_MS),
      ...scoreFeatures(extractFeatures(c, now), weights),
    }))
    .sort((a, b) => b.score - a.score);
}

export function getLeadModelStatus(orgId: string) {
  return prisma.insightModel.findUnique({ where: { orgId_kind: { orgId, kind: LEAD_SCORE_MODEL } } });
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export async function refreshSuggestions(orgId: string, now: Date): Promise<number> {
  const staleBefore = new Date(now.getTime() - SUGGESTION_CYCLE_DAYS * DAY_MS);
  await prisma.insightSuggestion.updateMany({
    where: { orgId, status: "open", createdAt: { lt: staleBefore } },
    data: { status: "expired" },
  });

  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const [leads, unresolved, plots, recentVisits, decided, open] = await Promise.all([
    getScoredLeads(orgId, now),
    prisma.visit.findMany({
      where: {
        orgId,
        status: "completed",
        outcome: null,
        scheduledAt: { gte: new Date(now.getTime() - SUGGESTION_CYCLE_DAYS * DAY_MS), lt: now },
      },
      include: { client: { select: { name: true } }, plot: { select: { title: true } } },
    }),
    prisma.plot.findMany({
      where: { orgId, status: "available" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { visits: { where: { scheduledAt: { gte: thirtyDaysAgo } } } } },
      },
    }),
    prisma.visit.findMany({
      where: { orgId, scheduledAt: { gte: ninetyDaysAgo, lt: now }, status: { in: ["completed", "no_show"] } },
      select: { status: true },
    }),
    prisma.insightSuggestion.groupBy({
      by: ["kind", "status"],
      where: { orgId, status: { in: ["accepted", "dismissed"] } },
      _count: { _all: true },
    }),
    prisma.insightSuggestion.findMany({ where: { orgId, status: "open" }, select: { dedupeKey: true } }),
  ]);

  const feedback: KindFeedback = {};
  for (const row of decided) {
    const tally = (feedback[row.kind] ??= { accepted: 0, dismissed: 0 });
    if (row.status === "accepted") tally.accepted = row._count._all;
    if (row.status === "dismissed") tally.dismissed = row._count._all;
  }

  const noShows = recentVisits.filter((v) => v.status === "no_show").length;
  const candidates = buildCandidates({
    leads,
    unresolvedVisits: unresolved.map((v) => ({
      visitId: v.id,
      clientName: v.client.name,
      plotTitle: v.plot.title,
      daysAgo: Math.floor((now.getTime() - v.scheduledAt.getTime()) / DAY_MS),
    })),
    availablePlots: plots.map((p) => ({
      plotId: p.id,
      title: p.title,
      daysListed: Math.floor((now.getTime() - p.createdAt.getTime()) / DAY_MS),
      visitsLast30Days: p._count.visits,
    })),
    noShowRatePct: recentVisits.length ? Math.round((noShows / recentVisits.length) * 100) : 0,
    visitsLast90Days: recentVisits.length,
  });

  // Skip anything already open, even if raised in the previous cycle.
  const openSubjects = new Set(open.map((o) => o.dedupeKey.split(":").slice(0, 2).join(":")));
  const fresh = rankCandidates(candidates, feedback).filter(
    (c) => !openSubjects.has(`${c.kind}:${c.entityId}`)
  );

  const { count } = await prisma.insightSuggestion.createMany({
    data: fresh.map((c) => ({
      orgId,
      kind: c.kind,
      dedupeKey: dedupeKey(c, now),
      ...suggestionText(c.kind, c.params, "en"),
      params: c.params,
      link: c.link,
      priority: c.priority,
    })),
    skipDuplicates: true,
  });
  return count;
}

export function getOpenSuggestions(orgId: string) {
  return prisma.insightSuggestion.findMany({
    where: { orgId, status: "open" },
    orderBy: { priority: "desc" },
    take: 8,
  });
}

// ─── Smart answers ────────────────────────────────────────────────────────────

export type AnswerResult = {
  answer: string;
  source: "llm" | "fallback";
  language: Locale;
  /** True when we couldn't place the question and the user can teach us the topic. */
  needsTopic: boolean;
};

/** Show a stored suggestion in the viewer's language. */
export function localizeSuggestion(
  s: { kind: string; title: string; body: string; params: unknown },
  locale: Locale
) {
  return s.params
    ? suggestionText(s.kind, s.params as SuggestionParams, locale)
    : { title: s.title, body: s.body };
}

async function buildFacts(orgId: string, kind: PeriodKind, now: Date, locale: Locale): Promise<InsightFacts> {
  const [metrics, leads, suggestions] = await Promise.all([
    computeReport(orgId, kind, now),
    getScoredLeads(orgId, now),
    getOpenSuggestions(orgId),
  ]);
  return {
    metrics,
    leads: leads.slice(0, 10).map(({ clientId, ...lead }): HotLead => lead),
    suggestions: suggestions.map((s) => localizeSuggestion(s, locale).title),
  };
}

export async function answerQuestion(
  orgId: string,
  question: string,
  kind: PeriodKind,
  now: Date,
  uiLocale: Locale
): Promise<AnswerResult> {
  const language = detectLanguage(question, uiLocale);
  const learned = await prisma.insightPhrase.findMany({
    where: { orgId },
    select: { question: true, intent: true },
  });
  const intent = classifyIntent(question, buildIntentModel(learned));
  const facts = await buildFacts(orgId, kind, now, language);

  const hidden = pseudonymize(facts);
  try {
    const result = await runLlm({
      orgId,
      kind: "insight",
      system: ASK_SYSTEM_PROMPT,
      user: buildAskMessage(question, hidden.facts, language),
    });
    if (result.ok && result.text) {
      return { answer: hidden.restore(result.text), source: "llm", language, needsTopic: false };
    }
  } catch (e) {
    console.warn("[insights] answer fell back:", e instanceof Error ? e.message : e);
  }
  return {
    answer: fallbackAnswer(intent, facts, language),
    source: "fallback",
    language,
    needsTopic: intent === "unknown",
  };
}

/** Save a user's correction, then answer on that topic straight away. */
export async function teachIntent(
  orgId: string,
  question: string,
  topic: Topic,
  kind: PeriodKind,
  now: Date,
  uiLocale: Locale
): Promise<AnswerResult> {
  const language = detectLanguage(question, uiLocale);
  await prisma.insightPhrase.create({ data: { orgId, question, intent: topic, language } });
  const facts = await buildFacts(orgId, kind, now, language);
  return { answer: fallbackAnswer(topic, facts, language), source: "fallback", language, needsTopic: false };
}

// ─── Daily job ────────────────────────────────────────────────────────────────

export async function runDailyInsights(orgId: string, now: Date) {
  const model = await retrainLeadModel(orgId, now);
  const suggestions = await refreshSuggestions(orgId, now);
  const reports = await ensureReports(orgId, now);
  return { modelSource: model.source, samples: model.sampleCount, suggestions, reports };
}

export function pruneStaffActivity(now: Date) {
  return prisma.staffActivity.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - STAFF_ACTIVITY_RETENTION_DAYS * DAY_MS) } },
  });
}
