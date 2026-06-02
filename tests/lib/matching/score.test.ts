import { describe, it, expect } from "vitest";
import { scoreMatches } from "@/lib/matching/score";
import type { Plot } from "@prisma/client";

function plotOf(over: Partial<Plot>): Plot {
  return {
    id: "p1",
    orgId: "o1",
    title: "Test",
    description: null,
    location: "Bangalore — Whitefield",
    city: "Bangalore",
    lat: null,
    lng: null,
    sizeSqft: 1200,
    priceInr: 7_500_000,
    status: "available",
    photos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Plot;
}

describe("scoreMatches", () => {
  it("perfect-fit client scores ~100", () => {
    const r = scoreMatches(plotOf({}), [
      {
        clientId: "c1",
        clientName: "Anita",
        preferences: {
          location: "Bangalore Whitefield",
          sizeSqftMin: 1000,
          sizeSqftMax: 1500,
          budgetInrMin: 5_000_000,
          budgetInrMax: 10_000_000,
          facings: [],
          mustHaves: [],
        },
      },
    ]);
    expect(r[0].score).toBeGreaterThanOrEqual(95);
    expect(r[0].ruledOut).toBe(false);
  });

  it("client with no preferences scores full (neutral)", () => {
    const r = scoreMatches(plotOf({}), [
      { clientId: "c1", clientName: "Empty", preferences: null },
    ]);
    expect(r[0].score).toBe(100);
  });

  it("buyer 3× over budget is ruled out", () => {
    const r = scoreMatches(plotOf({ priceInr: 30_000_000 }), [
      {
        clientId: "c1",
        clientName: "Tight",
        preferences: { budgetInrMax: 8_000_000 },
      },
    ]);
    expect(r[0].ruledOut).toBe(true);
    expect(r[0].breakdown.find((b) => b.dimension === "budget")?.points).toBe(0);
  });

  it("partial location overlap gives partial credit", () => {
    const r = scoreMatches(plotOf({ location: "Bangalore — HSR Layout" }), [
      {
        clientId: "c1",
        clientName: "City-only",
        preferences: { location: "Bangalore Whitefield" },
      },
    ]);
    const loc = r[0].breakdown.find((b) => b.dimension === "location")!;
    expect(loc.points).toBeGreaterThan(0);
    expect(loc.points).toBeLessThan(loc.weight);
  });

  it("ranks higher-score clients first", () => {
    const r = scoreMatches(plotOf({}), [
      { clientId: "low", clientName: "Mismatch", preferences: { location: "Mumbai" } },
      {
        clientId: "high",
        clientName: "Perfect",
        preferences: {
          location: "Bangalore Whitefield",
          sizeSqftMin: 1000,
          sizeSqftMax: 1500,
          budgetInrMin: 5_000_000,
          budgetInrMax: 10_000_000,
        },
      },
    ]);
    expect(r[0].clientId).toBe("high");
    expect(r[1].clientId).toBe("low");
  });

  it("east-facing description gives facing credit", () => {
    const r = scoreMatches(
      plotOf({ description: "Premium east-facing 30x40 plot in a gated community." }),
      [
        {
          clientId: "c1",
          clientName: "EastOnly",
          preferences: { facings: ["E"] },
        },
      ]
    );
    const facing = r[0].breakdown.find((b) => b.dimension === "facing")!;
    expect(facing.points).toBe(facing.weight);
  });

  it("must-haves substring-match against description", () => {
    const r = scoreMatches(
      plotOf({ description: "Has clubhouse, swimming pool, gym, 24x7 security." }),
      [
        {
          clientId: "c1",
          clientName: "Picky",
          preferences: { mustHaves: ["clubhouse", "swimming pool", "gym"] },
        },
      ]
    );
    const must = r[0].breakdown.find((b) => b.dimension === "must-haves")!;
    expect(must.points).toBe(must.weight);
    expect(must.note).toContain("3/3");
  });
});
