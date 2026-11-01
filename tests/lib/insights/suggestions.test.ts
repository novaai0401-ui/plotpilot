import { describe, it, expect } from "vitest";
import {
  buildCandidates,
  dedupeKey,
  feedbackMultiplier,
  rankCandidates,
  SUGGESTION_CYCLE_DAYS,
  suggestionText,
  type Candidate,
  type SuggestionInput,
} from "@/lib/insights/suggestions";

const NOW = new Date("2026-11-01T06:30:00Z");

function input(over: Partial<SuggestionInput> = {}): SuggestionInput {
  return { leads: [], unresolvedVisits: [], availablePlots: [], noShowRatePct: 0, visitsLast90Days: 0, ...over };
}

const lead = (band: "hot" | "warm" | "cold", score: number, daysSinceContact: number) => ({
  clientId: "c1",
  name: "Asha",
  band,
  score,
  daysSinceContact,
});

describe("buildCandidates", () => {
  it("flags a hot lead that's gone quiet, but not one contacted recently", () => {
    expect(buildCandidates(input({ leads: [lead("hot", 80, 5)] }))[0].kind).toBe("call_hot_lead");
    expect(buildCandidates(input({ leads: [lead("hot", 80, 1)] }))).toHaveLength(0);
  });

  it("flags warm leads only after two weeks, and never cold ones", () => {
    expect(buildCandidates(input({ leads: [lead("warm", 40, 14)] }))[0].kind).toBe("revive_warm_lead");
    expect(buildCandidates(input({ leads: [lead("warm", 40, 13)] }))).toHaveLength(0);
    expect(buildCandidates(input({ leads: [lead("cold", 10, 200)] }))).toHaveLength(0);
  });

  it("asks for outcomes on visits nobody has resolved", () => {
    const [c] = buildCandidates(
      input({ unresolvedVisits: [{ visitId: "v1", clientName: "Asha", plotTitle: "Palm Grove", daysAgo: 2 }] })
    );
    expect(c).toMatchObject({ kind: "record_outcome", link: "/dashboard/visits/v1" });
  });

  it("flags plots that have stopped attracting visits", () => {
    const plot = { plotId: "p1", title: "Lake Road", daysListed: 60, visitsLast30Days: 0 };
    expect(buildCandidates(input({ availablePlots: [plot] }))[0].kind).toBe("refresh_plot");
    expect(buildCandidates(input({ availablePlots: [{ ...plot, visitsLast30Days: 1 }] }))).toHaveLength(0);
    expect(buildCandidates(input({ availablePlots: [{ ...plot, daysListed: 20 }] }))).toHaveLength(0);
  });

  it("raises no-shows only with enough visits to mean something", () => {
    expect(buildCandidates(input({ noShowRatePct: 30, visitsLast90Days: 10 }))[0].kind).toBe("reduce_no_shows");
    expect(buildCandidates(input({ noShowRatePct: 50, visitsLast90Days: 4 }))).toHaveLength(0);
  });
});

describe("suggestionText", () => {
  const params = { name: "Asha", score: 80, days: 5 };

  it("renders the same suggestion in each language", () => {
    expect(suggestionText("call_hot_lead", params, "en").title).toBe("Call Asha today");
    expect(suggestionText("call_hot_lead", params, "hi").title).toBe("आज Asha को कॉल करें");
    expect(suggestionText("call_hot_lead", params, "mr").title).toBe("आज Asha यांना कॉल करा");
  });
});

describe("feedback learning", () => {
  const candidate = (kind: Candidate["kind"], priority: number): Candidate => ({
    kind,
    entityId: kind,
    params: {},
    link: "/",
    priority,
  });

  it("leaves untried kinds unchanged", () => {
    expect(feedbackMultiplier()).toBe(1);
    expect(feedbackMultiplier({ accepted: 3, dismissed: 3 })).toBe(1);
  });

  it("isn't swung by a single click", () => {
    expect(feedbackMultiplier({ accepted: 0, dismissed: 1 })).toBeGreaterThan(0.75);
  });

  it("moves a repeatedly dismissed kind below one the team acts on", () => {
    const ranked = rankCandidates([candidate("call_hot_lead", 90), candidate("refresh_plot", 35)], {
      call_hot_lead: { accepted: 0, dismissed: 20 },
      refresh_plot: { accepted: 20, dismissed: 0 },
    });
    expect(ranked[0].kind).toBe("refresh_plot");
  });

  it("limits how many suggestions are shown", () => {
    const kinds = ["record_outcome", "call_hot_lead", "revive_warm_lead", "refresh_plot"] as const;
    const many = kinds.flatMap((kind) =>
      Array.from({ length: 5 }, (_, i) => ({ ...candidate(kind, i), entityId: `${kind}${i}` }))
    );
    expect(rankCandidates(many, {})).toHaveLength(8);
  });

  it("doesn't let one kind crowd out the rest", () => {
    const calls = Array.from({ length: 7 }, (_, i) => ({ ...candidate("call_hot_lead", 90), entityId: String(i) }));
    const ranked = rankCandidates([...calls, candidate("refresh_plot", 35)], {});
    expect(ranked.filter((c) => c.kind === "call_hot_lead")).toHaveLength(3);
    expect(ranked.some((c) => c.kind === "refresh_plot")).toBe(true);
  });
});

describe("dedupeKey", () => {
  const c = { kind: "call_hot_lead" as const, entityId: "c1" };

  it("is stable within a cycle so a dismissal sticks", () => {
    const sameCycle = new Date(Math.floor(NOW.getTime() / (14 * 86_400_000)) * 14 * 86_400_000);
    expect(dedupeKey(c, sameCycle)).toBe(dedupeKey(c, new Date(sameCycle.getTime() + 86_400_000)));
  });

  it("changes in the next cycle so a still-relevant item can return", () => {
    const later = new Date(NOW.getTime() + SUGGESTION_CYCLE_DAYS * 86_400_000);
    expect(dedupeKey(c, later)).not.toBe(dedupeKey(c, NOW));
  });
});
