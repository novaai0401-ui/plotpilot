import { describe, it, expect } from "vitest";
import {
  RequirementsSchema,
  buildableFootprint,
  maxBuiltUpSqft,
} from "@/lib/architect/requirements";

describe("RequirementsSchema", () => {
  it("accepts a minimal valid input and applies defaults", () => {
    const parsed = RequirementsSchema.parse({
      projectType: "residential_house",
      plot: { totalSqft: 2000 },
    });
    expect(parsed.floors).toBe(2);
    expect(parsed.unitsPerFloor).toBe(1);
    expect(parsed.rooms.bedrooms).toBe(3);
    expect(parsed.plot.maxFAR).toBe(2.0);
    expect(parsed.preferences.style).toBe("modern");
  });

  it("rejects unknown projectType", () => {
    expect(() =>
      RequirementsSchema.parse({ projectType: "spaceship", plot: { totalSqft: 2000 } })
    ).toThrow();
  });

  it("rejects out-of-range totalSqft", () => {
    expect(() => RequirementsSchema.parse({ projectType: "residential_house", plot: { totalSqft: 50 } })).toThrow();
    expect(() => RequirementsSchema.parse({ projectType: "residential_house", plot: { totalSqft: 5_000_000 } })).toThrow();
  });

  it("clamps floors via schema range", () => {
    expect(() =>
      RequirementsSchema.parse({ projectType: "residential_house", plot: { totalSqft: 2000 }, floors: 0 })
    ).toThrow();
    expect(() =>
      RequirementsSchema.parse({ projectType: "residential_house", plot: { totalSqft: 2000 }, floors: 100 })
    ).toThrow();
  });

  it("accepts known facing directions only", () => {
    expect(() =>
      RequirementsSchema.parse({
        projectType: "residential_house",
        plot: { totalSqft: 2000, facing: "UP" },
      })
    ).toThrow();
  });
});

describe("buildableFootprint", () => {
  const r = (overrides: any = {}) =>
    RequirementsSchema.parse({
      projectType: "residential_house",
      plot: { totalSqft: 2400, ...overrides },
    });

  it("subtracts setbacks from explicit frontage + depth", () => {
    const fp = buildableFootprint(
      r({ frontageFt: 40, depthFt: 60, setbackFrontFt: 5, setbackRearFt: 3, setbackSideFt: 3 })
    );
    expect(fp.widthFt).toBe(40 - 3 * 2);
    expect(fp.depthFt).toBe(60 - 5 - 3);
  });

  it("falls back to a square approximation when frontage/depth missing", () => {
    const fp = buildableFootprint(r({ totalSqft: 1600 })); // sqrt = 40
    expect(fp.widthFt).toBeCloseTo(40 - 3 * 2, 0);
  });

  it("never returns dimensions smaller than the safety floor of 10ft", () => {
    const fp = buildableFootprint(
      r({ frontageFt: 12, depthFt: 12, setbackFrontFt: 10, setbackRearFt: 10, setbackSideFt: 10 })
    );
    expect(fp.widthFt).toBeGreaterThanOrEqual(10);
    expect(fp.depthFt).toBeGreaterThanOrEqual(10);
  });
});

describe("maxBuiltUpSqft", () => {
  it("multiplies plot area by FAR", () => {
    const r = RequirementsSchema.parse({
      projectType: "residential_house",
      plot: { totalSqft: 2000, maxFAR: 2.5 },
    });
    expect(maxBuiltUpSqft(r)).toBe(5000);
  });
});
