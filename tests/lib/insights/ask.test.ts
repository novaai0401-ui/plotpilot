import { describe, it, expect } from "vitest";
import { buildAskMessage, fallbackAnswer, pseudonymize, type InsightFacts } from "@/lib/insights/ask";
import { buildIntentModel, classifyIntent, detectLanguage } from "@/lib/insights/intent-model";
import { computeMetrics } from "@/lib/insights/metrics";
import { latestCompletedRange, previousRange } from "@/lib/insights/periods";
import { normalizeDashboardPath } from "@/lib/insights/normalize-path";
import { chooseModel } from "@/lib/llm/models";

const NOW = new Date("2026-11-01T06:30:00Z");
const range = latestCompletedRange("month", NOW);
const OCT = new Date("2026-10-10T06:30:00Z");

const metrics = computeMetrics({
  kind: "month",
  range,
  previous: previousRange("month", range),
  events: [],
  visits: [
    {
      agentId: "a1",
      plotId: "p1",
      clientId: "c1",
      status: "completed",
      outcome: "booked",
      outcomeAt: OCT,
      scheduledAt: OCT,
    },
  ],
  activity: [],
  agentNames: { a1: "Ravi Kumar" },
  plotTitles: { p1: "Palm Grove" },
});

const facts: InsightFacts = {
  metrics,
  leads: [
    { name: "Asha Rao", score: 82, band: "hot", daysSinceContact: 5, reasons: ["insights.reason.recentReplies.good"] },
    { name: "Asha", score: 40, band: "warm", daysSinceContact: 20, reasons: [] },
  ],
  suggestions: ["Call Asha Rao today"],
};

describe("classifyIntent", () => {
  const model = buildIntentModel();

  it.each([
    ["Which leads are strongest?", "leads"],
    ["Top plots this month", "plots"],
    ["How is my team doing?", "agents"],
    ["How did we do last month?", "performance"],
    ["What should I do about my leads?", "actions"],
    ["मेरे ग्राहक कौन हैं", "leads"],
    ["किन प्लॉट पर विज़िट हो रही हैं?", "plots"],
    ["इस महीने की बुकिंग कैसी रही", "performance"],
    ["kya karu aaj", "actions"],
    ["माझे ग्राहक दाखवा", "leads"],
    ["कोणत्या प्लॉटला भेटी मिळत आहेत?", "plots"],
    ["आज मी काय करू?", "actions"],
    ["माझी टीम कशी आहे", "agents"],
    ["What's the capital of France?", "unknown"],
  ])("%s -> %s", (q, intent) => {
    expect(classifyIntent(q, model)).toBe(intent);
  });

  it("recognises inflected forms from the stem", () => {
    expect(classifyIntent("ग्राहकांना दाखवा", model)).toBe("leads");
    expect(classifyIntent("ग्राहकों की सूची", model)).toBe("leads");
  });
});

describe("learning from corrections", () => {
  const question = "dalali kitni aayi";

  it("doesn't know a new phrase at first", () => {
    expect(classifyIntent(question, buildIntentModel())).toBe("unknown");
  });

  it("recognises it, and similar wording, once taught", () => {
    const model = buildIntentModel([{ question, intent: "performance" }]);
    expect(classifyIntent(question, model)).toBe("performance");
    expect(classifyIntent("is mahine dalali", model)).toBe("performance");
  });

  it("one org's teaching doesn't exist in a model built without it", () => {
    buildIntentModel([{ question, intent: "performance" }]);
    expect(classifyIntent(question, buildIntentModel())).toBe("unknown");
  });

  it("ignores a stored phrase with an invalid topic", () => {
    expect(classifyIntent(question, buildIntentModel([{ question, intent: "nonsense" }]))).toBe("unknown");
  });
});

describe("detectLanguage", () => {
  it.each([
    ["Which leads are best?", "en", "en"],
    ["Which leads are best?", "hi", "en"],
    ["मेरे ग्राहक कौन हैं", "en", "hi"],
    ["माझे ग्राहक कोणते आहेत", "en", "mr"],
    ["या महिन्यात कसे झाले?", "hi", "mr"],
    ["kya karu aaj", "en", "hi"],
    ["kay karu aaj", "en", "mr"],
  ] as const)("%s (ui %s) -> %s", (q, ui, expected) => {
    expect(detectLanguage(q, ui)).toBe(expected);
  });

  it("uses the viewer's language when Hindi and Marathi can't be told apart", () => {
    expect(detectLanguage("ग्राहक", "mr")).toBe("mr");
    expect(detectLanguage("ग्राहक", "en")).toBe("hi");
  });
});

describe("fallbackAnswer", () => {
  it("answers from the facts", () => {
    expect(fallbackAnswer("leads", facts, "en")).toContain("Asha Rao: score 82");
    expect(fallbackAnswer("plots", facts, "en")).toContain("Palm Grove (1 visits, 1 booked)");
    expect(fallbackAnswer("actions", facts, "en")).toContain("Call Asha Rao today");
  });

  it("answers in Hindi and Marathi, with translated labels and months", () => {
    const hindi = fallbackAnswer("leads", facts, "hi");
    expect(hindi).toContain("स्कोर 82");
    expect(hindi).toContain("गर्म");
    expect(fallbackAnswer("performance", facts, "hi")).toContain("अक्टू 2026");

    const marathi = fallbackAnswer("leads", facts, "mr");
    expect(marathi).toContain("स्कोअर 82");
    expect(marathi).toContain("गरम");
    expect(fallbackAnswer("performance", facts, "mr")).toContain("ऑक्टो 2026");
  });

  it("says what it can do rather than guessing", () => {
    expect(fallbackAnswer("unknown", facts, "en")).toContain("I can answer questions about");
  });
});

describe("pseudonymize", () => {
  const { facts: hidden, restore } = pseudonymize(facts);
  const sent = buildAskMessage("Who first?", hidden, "en");

  it("removes real names from everything sent to the LLM", () => {
    expect(sent).not.toContain("Asha");
    expect(sent).not.toContain("Ravi");
    expect(sent).toContain("Client 1");
    expect(sent).toContain("Agent 1");
  });

  it("sends reasons as words, not dictionary keys", () => {
    expect(sent).toContain("Replied recently");
    expect(sent).not.toContain("insights.reason");
  });

  it("passes the language to answer in", () => {
    expect(buildAskMessage("?", hidden, "mr")).toContain("<language>mr</language>");
  });

  it("restores names in the reply", () => {
    expect(restore("Call Client 1 before Client 2, then ask Agent 1.")).toBe(
      "Call Asha Rao before Asha, then ask Ravi Kumar."
    );
  });

  it("doesn't confuse Client 1 with Client 10", () => {
    const many = pseudonymize({
      ...facts,
      leads: Array.from({ length: 10 }, (_, i) => ({ ...facts.leads[0], name: `Person${i + 1}` })),
    });
    expect(many.restore("Client 10 and Client 1")).toBe("Person10 and Person1");
  });

  it("leaves the original facts untouched for the fallback path", () => {
    expect(facts.leads[0].name).toBe("Asha Rao");
  });
});

describe("normalizeDashboardPath", () => {
  it("removes record ids and query strings", () => {
    expect(normalizeDashboardPath("/dashboard/clients/cm3xk2j4l0000abcd1234efgh?tab=x")).toBe("/dashboard/clients/[id]");
  });

  it("rejects anything outside the dashboard", () => {
    expect(normalizeDashboardPath("/portal/visits")).toBeNull();
    expect(normalizeDashboardPath("/dashboardx")).toBeNull();
    expect(normalizeDashboardPath(42)).toBeNull();
  });
});

describe("insight model choice", () => {
  it("keeps free orgs off paid AI and uses Haiku for paid plans", () => {
    expect(chooseModel("free", "insight").model).toBeNull();
    expect(chooseModel("pro", "insight").model).toBe("claude-haiku-4-5");
    expect(chooseModel("enterprise", "insight").model).toBe("claude-haiku-4-5");
  });
});
