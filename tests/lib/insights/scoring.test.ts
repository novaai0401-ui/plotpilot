import { describe, it, expect } from "vitest";
import {
  buildSamples,
  extractFeatures,
  isClosed,
  MIN_SAMPLES_TO_TRAIN,
  parseWeights,
  PRIOR_WEIGHTS,
  scoreFeatures,
  trainLeadModel,
  type ClientActivity,
  type FeatureVector,
  type Sample,
} from "@/lib/insights/scoring";
import { buildSampleHistory } from "@/prisma/sample-history";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-01T06:30:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

function client(over: Partial<ClientActivity> = {}): ClientActivity {
  return {
    clientId: "c1",
    name: "Asha",
    createdAt: daysAgo(30),
    hasPreferences: false,
    visits: [],
    replies: [],
    outreach: [],
    ...over,
  };
}

const zeroFeatures: FeatureVector = {
  visitsCompleted: 0,
  noShows: 0,
  recentReplies: 0,
  staleness: 0,
  hasPreferences: 0,
  showedInterest: 0,
  declined: 0,
};

describe("extractFeatures", () => {
  it("ignores everything at or after the as-of time", () => {
    const c = client({
      visits: [
        { status: "completed", outcome: "booked", outcomeAt: daysAgo(5), scheduledAt: daysAgo(6) },
        { status: "completed", outcome: "interested", outcomeAt: daysAgo(15), scheduledAt: daysAgo(16) },
      ],
      replies: [daysAgo(7), daysAgo(20)],
    });
    const x = extractFeatures(c, daysAgo(10));
    expect(x.visitsCompleted).toBeCloseTo(Math.log1p(1));
    expect(x.showedInterest).toBe(1);
    expect(x.recentReplies).toBeCloseTo(Math.log1p(1));
  });

  it("only counts replies from the last 30 days", () => {
    const x = extractFeatures(client({ replies: [daysAgo(10), daysAgo(45)] }), NOW);
    expect(x.recentReplies).toBeCloseTo(Math.log1p(1));
  });

  it("caps staleness so very old leads don't dominate", () => {
    const x = extractFeatures(client({ createdAt: daysAgo(900) }), NOW);
    expect(x.staleness).toBe(3);
  });
});

describe("scoreFeatures", () => {
  const engaged: FeatureVector = { ...zeroFeatures, visitsCompleted: 1.4, recentReplies: 1.4, showedInterest: 1, hasPreferences: 1 };

  it("rates an engaged client above an inactive one", () => {
    const hot = scoreFeatures(engaged, PRIOR_WEIGHTS);
    const cold = scoreFeatures({ ...zeroFeatures, staleness: 3 }, PRIOR_WEIGHTS);
    expect(hot.band).toBe("hot");
    expect(cold.band).toBe("cold");
    expect(hot.score).toBeGreaterThan(cold.score);
  });

  it("explains itself with the biggest factors", () => {
    expect(scoreFeatures(engaged, PRIOR_WEIGHTS).reasons).toContain("insights.reason.showedInterest.good");
    expect(scoreFeatures({ ...zeroFeatures, declined: 1 }, PRIOR_WEIGHTS).reasons).toContain("insights.reason.declined.bad");
  });
});

describe("isClosed", () => {
  it("is true only after a booking", () => {
    expect(isClosed(client())).toBe(false);
    expect(
      isClosed(client({ visits: [{ status: "completed", outcome: "booked", outcomeAt: daysAgo(1), scheduledAt: daysAgo(2) }] }))
    ).toBe(true);
  });
});

describe("buildSamples", () => {
  it("labels booked as 1 and declined or silent as 0", () => {
    const samples = buildSamples(
      [
        client({ clientId: "booked", visits: [{ status: "completed", outcome: "booked", outcomeAt: daysAgo(3), scheduledAt: daysAgo(4) }] }),
        client({ clientId: "declined", visits: [{ status: "completed", outcome: "not_interested", outcomeAt: daysAgo(3), scheduledAt: daysAgo(4) }] }),
        client({ clientId: "silent", createdAt: daysAgo(120) }),
      ],
      NOW
    );
    expect(samples.map((s) => s.y).sort()).toEqual([0, 0, 1]);
  });

  it("skips leads whose story hasn't ended", () => {
    expect(buildSamples([client({ createdAt: daysAgo(20) })], NOW)).toHaveLength(0);
  });

  it("never lets the final decision leak into its own training features", () => {
    const [sample] = buildSamples(
      [client({ visits: [{ status: "completed", outcome: "not_interested", outcomeAt: daysAgo(3), scheduledAt: daysAgo(4) }] })],
      NOW
    );
    expect(sample.x.declined).toBe(0);
  });
});

function syntheticSamples(n: number): Sample[] {
  // Clients who replied book; others don't. A pattern the prior underrates.
  return Array.from({ length: n }, (_, i) => {
    const replied = i % 2 === 0;
    return {
      x: { ...zeroFeatures, recentReplies: replied ? 1.5 : 0 },
      y: replied ? 1 : 0,
      asOf: new Date(NOW.getTime() - (n - i) * DAY),
    } as Sample;
  });
}

describe("trainLeadModel", () => {
  it("keeps the starter weights until there's enough data", () => {
    const m = trainLeadModel(syntheticSamples(MIN_SAMPLES_TO_TRAIN - 1));
    expect(m.source).toBe("prior");
    expect(m.weights).toEqual(PRIOR_WEIGHTS);
  });

  it("keeps the starter weights if every outcome is the same", () => {
    const allLost = syntheticSamples(40).map((s) => ({ ...s, y: 0 as const }));
    expect(trainLeadModel(allLost).source).toBe("prior");
  });

  it("learns a pattern from the org's own outcomes", () => {
    const m = trainLeadModel(syntheticSamples(100));
    expect(m.source).toBe("trained");
    expect(m.weights.recentReplies).toBeGreaterThan(PRIOR_WEIGHTS.recentReplies);
  });

  it("stays nearer the prior on less data", () => {
    const small = trainLeadModel(syntheticSamples(30)).weights.recentReplies;
    const large = trainLeadModel(syntheticSamples(300)).weights.recentReplies;
    expect(large).toBeGreaterThan(small);
  });

  it("reports accuracy on outcomes it wasn't fitted on", () => {
    const m = trainLeadModel(syntheticSamples(100));
    expect(m.heldOutAccuracy).toBeGreaterThan(0.9);
    expect(m.baselineAccuracy).toBeCloseTo(0.5);
  });

  it("doesn't claim an accuracy figure on a small dataset", () => {
    expect(trainLeadModel(syntheticSamples(40)).heldOutAccuracy).toBeNull();
  });
});

describe("sample history end to end", () => {
  const history = buildSampleHistory("org", ["a1", "a2"], NOW);
  const clients: ClientActivity[] = history.clients.map((c) => ({
    clientId: c.id!,
    name: c.name,
    createdAt: c.createdAt as Date,
    hasPreferences: c.preferences != null,
    visits: history.visits
      .filter((v) => v.clientId === c.id)
      .map((v) => ({
        status: v.status as ClientActivity["visits"][number]["status"],
        outcome: (v.outcome ?? null) as ClientActivity["visits"][number]["outcome"],
        outcomeAt: (v.outcomeAt ?? null) as Date | null,
        scheduledAt: v.scheduledAt as Date,
      })),
    replies: history.messages.filter((m) => m.senderId === c.id).map((m) => m.createdAt as Date),
    outreach: history.messages.filter((m) => m.recipientId === c.id).map((m) => m.createdAt as Date),
  }));

  it("is identical on every run", () => {
    expect(buildSampleHistory("org", ["a1", "a2"], NOW).visits).toEqual(history.visits);
  });

  it("can't reach a real person: no dialable phones, only reserved email domains", () => {
    for (const c of history.clients) {
      expect(c.phone.startsWith("+910")).toBe(true);
      expect(c.email?.endsWith("@example.com")).toBe(true);
    }
    for (const i of history.invitations) expect(i.clientPhone.startsWith("+910")).toBe(true);
  });

  it("has content in English, Hindi and Marathi", () => {
    const text = [...history.messages.map((m) => m.body), ...history.clients.map((c) => c.name)].join(" ");
    expect(text).toMatch(/price negotiable/);
    expect(text).toMatch(/कीमत/);
    expect(text).toMatch(/किंमत/);
  });

  it("has unique client phones and emails", () => {
    expect(new Set(history.clients.map((c) => c.phone)).size).toBe(history.clients.length);
    expect(new Set(history.clients.map((c) => c.email)).size).toBe(history.clients.length);
  });

  it("has no message or decision dated in the future", () => {
    expect(history.messages.every((m) => (m.createdAt as Date) < NOW)).toBe(true);
    expect(history.visits.every((v) => !v.outcomeAt || (v.outcomeAt as Date) < NOW)).toBe(true);
  });

  it("gives the model enough outcomes to train, and it beats guessing", () => {
    const m = trainLeadModel(buildSamples(clients, NOW));
    expect(m.source).toBe("trained");
    expect(m.heldOutAccuracy).not.toBeNull();
    expect(m.heldOutAccuracy!).toBeGreaterThan(m.baselineAccuracy!);
  });

  it("leaves hot and warm leads to act on, not just cold ones", () => {
    const m = trainLeadModel(buildSamples(clients, NOW));
    const bands = clients
      .filter((c) => !isClosed(c))
      .map((c) => scoreFeatures(extractFeatures(c, NOW), m.weights).band);
    expect(bands.filter((b) => b === "hot").length).toBeGreaterThanOrEqual(3);
    expect(bands.filter((b) => b === "warm").length).toBeGreaterThanOrEqual(3);
  });
});

describe("parseWeights", () => {
  it("uses the prior if stored weights are malformed", () => {
    expect(parseWeights({ bias: 1 })).toEqual(PRIOR_WEIGHTS);
    expect(parseWeights(null)).toEqual(PRIOR_WEIGHTS);
    expect(parseWeights({ ...PRIOR_WEIGHTS, declined: Number.NaN })).toEqual(PRIOR_WEIGHTS);
  });

  it("accepts valid stored weights", () => {
    const w = { ...PRIOR_WEIGHTS, bias: -1 };
    expect(parseWeights(w)).toEqual(w);
  });
});
