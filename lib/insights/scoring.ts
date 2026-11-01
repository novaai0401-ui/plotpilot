/**
 * Lead scoring that learns per brokerage.
 *
 * The model is logistic regression, trained in-process on the org's own
 * outcomes. It starts from `PRIOR_WEIGHTS` (a broker's common sense written as
 * numbers) and moves away from them only as far as the data justifies, because
 * training pulls weights back toward the prior. So a brokerage with little
 * history gets sensible scores and one with plenty gets scores fitted to it.
 *
 * Why logistic regression and not something fancier: brokerages have hundreds
 * of outcomes, not millions, and each weight maps to a reason a broker can read
 * ("replied recently"). A score nobody can explain doesn't get acted on.
 *
 * Features for a training sample are taken AS OF just before the outcome. Using
 * anything from after it would let the model cheat, and its accuracy figure
 * would be meaningless.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const FEATURES = [
  "visitsCompleted",
  "noShows",
  "recentReplies",
  "staleness",
  "hasPreferences",
  "showedInterest",
  "declined",
] as const;

export type FeatureName = (typeof FEATURES)[number];
export type FeatureVector = Record<FeatureName, number>;
export type Weights = FeatureVector & { bias: number };

export const PRIOR_WEIGHTS: Weights = {
  bias: -2,
  visitsCompleted: 0.9,
  noShows: -0.6,
  recentReplies: 0.5,
  staleness: -0.6,
  hasPreferences: 0.3,
  showedInterest: 1.2,
  declined: -2,
};

export const MIN_SAMPLES_TO_TRAIN = 30;
const MIN_SAMPLES_FOR_HOLDOUT = 50;
/** How strongly weights are held to the prior; about this many outcomes' worth. */
const PRIOR_STRENGTH = 5;
const ITERATIONS = 400;
const LEARNING_RATE = 0.1;
/** No contact for this long, with no decision, counts as a lost lead. */
export const INACTIVE_AFTER_DAYS = 90;

export type ActivityVisit = {
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  outcome: "interested" | "not_interested" | "booked" | null;
  outcomeAt: Date | null;
  scheduledAt: Date;
};

export type ClientActivity = {
  clientId: string;
  name: string;
  createdAt: Date;
  hasPreferences: boolean;
  visits: ActivityVisit[];
  /** Timestamps of messages the client sent us. */
  replies: Date[];
  /** Timestamps of messages we sent the client. */
  outreach: Date[];
};

export function lastContactAt(c: ClientActivity, asOf: Date): Date {
  const times = [
    c.createdAt.getTime(),
    ...c.visits.filter((v) => v.status === "completed").map((v) => v.scheduledAt.getTime()),
    ...c.replies.map((d) => d.getTime()),
    ...c.outreach.map((d) => d.getTime()),
  ].filter((t) => t < asOf.getTime());
  return new Date(times.length ? Math.max(...times) : c.createdAt.getTime());
}

export function extractFeatures(c: ClientActivity, asOf: Date): FeatureVector {
  const cutoff = asOf.getTime();
  const visits = c.visits.filter((v) => v.scheduledAt.getTime() < cutoff);
  const decided = c.visits.filter((v) => v.outcomeAt && v.outcomeAt.getTime() < cutoff);
  const recentReplies = c.replies.filter((d) => {
    const t = d.getTime();
    return t < cutoff && t >= cutoff - 30 * DAY_MS;
  }).length;
  const idleDays = (cutoff - lastContactAt(c, asOf).getTime()) / DAY_MS;

  return {
    visitsCompleted: Math.log1p(visits.filter((v) => v.status === "completed").length),
    noShows: Math.min(visits.filter((v) => v.status === "no_show").length, 3),
    recentReplies: Math.log1p(recentReplies),
    staleness: Math.min(Math.max(idleDays, 0), INACTIVE_AFTER_DAYS) / 30,
    hasPreferences: c.hasPreferences ? 1 : 0,
    showedInterest: decided.some((v) => v.outcome === "interested") ? 1 : 0,
    declined: decided.some((v) => v.outcome === "not_interested") ? 1 : 0,
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function linear(x: FeatureVector, w: Weights): number {
  return FEATURES.reduce((sum, f) => sum + w[f] * x[f], w.bias);
}

export type Band = "hot" | "warm" | "cold";
/** `reasons` are dictionary keys, so they can be shown in the viewer's language. */
export type LeadScore = { score: number; band: Band; reasons: string[] };

export function scoreFeatures(x: FeatureVector, w: Weights): LeadScore {
  const score = Math.round(sigmoid(linear(x, w)) * 100);
  const contributions = FEATURES.map((f) => ({ f, c: w[f] * x[f] })).sort((a, b) => b.c - a.c);
  const reasons = [
    ...contributions.filter((e) => e.c > 0.05).slice(0, 2).map((e) => `insights.reason.${e.f}.good`),
    ...contributions.filter((e) => e.c < -0.05).slice(-1).map((e) => `insights.reason.${e.f}.bad`),
  ];
  return { score, band: score >= 60 ? "hot" : score >= 30 ? "warm" : "cold", reasons };
}

/** True once the client has reached a final outcome and shouldn't be scored as a lead. */
export function isClosed(c: ClientActivity): boolean {
  return c.visits.some((v) => v.outcome === "booked");
}

export type Sample = { x: FeatureVector; y: 0 | 1; asOf: Date };

/**
 * One sample per client whose story has ended. Booked is a positive; an
 * explicit "not interested" or going silent is a negative. Open leads are
 * skipped, because we don't know yet how they end.
 */
export function buildSamples(clients: ClientActivity[], now: Date): Sample[] {
  const samples: Sample[] = [];
  for (const c of clients) {
    const byTime = (a: ActivityVisit, b: ActivityVisit) => a.outcomeAt!.getTime() - b.outcomeAt!.getTime();
    const decided = c.visits.filter((v) => v.outcome && v.outcomeAt).sort(byTime);
    const booked = decided.find((v) => v.outcome === "booked");
    const declined = decided.filter((v) => v.outcome === "not_interested").pop();
    const lastContact = lastContactAt(c, now);

    if (booked) {
      samples.push({ x: extractFeatures(c, booked.outcomeAt!), y: 1, asOf: booked.outcomeAt! });
    } else if (declined) {
      samples.push({ x: extractFeatures(c, declined.outcomeAt!), y: 0, asOf: declined.outcomeAt! });
    } else if (now.getTime() - lastContact.getTime() > INACTIVE_AFTER_DAYS * DAY_MS) {
      const asOf = new Date(lastContact.getTime() + 1);
      samples.push({ x: extractFeatures(c, asOf), y: 0, asOf });
    }
  }
  return samples.sort((a, b) => a.asOf.getTime() - b.asOf.getTime());
}

/** Maximum-a-posteriori logistic regression: fit the data, stay near the prior. */
function fit(samples: Sample[], prior: Weights): Weights {
  const w: Weights = { ...prior };
  const n = samples.length;
  const keys = ["bias", ...FEATURES] as const;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const grad = Object.fromEntries(keys.map((k) => [k, 0])) as Weights;
    for (const s of samples) {
      const err = sigmoid(linear(s.x, w)) - s.y;
      grad.bias += err;
      for (const f of FEATURES) grad[f] += err * s.x[f];
    }
    for (const k of keys) {
      w[k] -= LEARNING_RATE * (grad[k] / n + (PRIOR_STRENGTH / n) * (w[k] - prior[k]));
    }
  }
  return w;
}

function accuracy(samples: Sample[], w: Weights): number {
  const correct = samples.filter((s) => (sigmoid(linear(s.x, w)) >= 0.5 ? 1 : 0) === s.y).length;
  return correct / samples.length;
}

export type TrainedModel = {
  weights: Weights;
  source: "trained" | "prior";
  sampleCount: number;
  positiveCount: number;
  /** Accuracy on the newest 20% of outcomes, unseen during that fit. */
  heldOutAccuracy: number | null;
  /** Accuracy of always guessing the commoner result on those same outcomes. */
  baselineAccuracy: number | null;
};

export function trainLeadModel(samples: Sample[], prior: Weights = PRIOR_WEIGHTS): TrainedModel {
  const positiveCount = samples.filter((s) => s.y === 1).length;
  const base = { sampleCount: samples.length, positiveCount };
  const hasBothClasses = positiveCount > 0 && positiveCount < samples.length;

  if (samples.length < MIN_SAMPLES_TO_TRAIN || !hasBothClasses) {
    return { ...base, weights: prior, source: "prior", heldOutAccuracy: null, baselineAccuracy: null };
  }

  let heldOutAccuracy: number | null = null;
  let baselineAccuracy: number | null = null;
  if (samples.length >= MIN_SAMPLES_FOR_HOLDOUT) {
    // Split by time, not at random: the question that matters is whether
    // yesterday's outcomes predict tomorrow's.
    const split = Math.floor(samples.length * 0.8);
    const train = samples.slice(0, split);
    const test = samples.slice(split);
    const trainPositives = train.filter((s) => s.y === 1).length;
    if (trainPositives > 0 && trainPositives < train.length) {
      heldOutAccuracy = accuracy(test, fit(train, prior));
      const testPositives = test.filter((s) => s.y === 1).length / test.length;
      baselineAccuracy = Math.max(testPositives, 1 - testPositives);
    }
  }

  return { ...base, weights: fit(samples, prior), source: "trained", heldOutAccuracy, baselineAccuracy };
}

/** Read stored weights, falling back to the prior if the shape is ever stale. */
export function parseWeights(raw: unknown): Weights {
  const w = raw as Partial<Weights> | null;
  const keys = ["bias", ...FEATURES] as const;
  if (!w || keys.some((k) => typeof w[k] !== "number" || !Number.isFinite(w[k]))) return PRIOR_WEIGHTS;
  return w as Weights;
}
