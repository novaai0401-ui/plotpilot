import { describe, it, expect } from "vitest";
import { generateBrief } from "@/lib/architect/rules";
import { RequirementsSchema, type Requirements } from "@/lib/architect/requirements";

/**
 * Helper: build a valid Requirements object with overrides.
 * Uses the schema's defaults so each test only sets fields it cares about.
 */
function reqs(overrides: Partial<Requirements> = {}): Requirements {
  const base: Requirements = RequirementsSchema.parse({
    projectType: "residential_house",
    plot: { totalSqft: 2400 },
    ...overrides,
  });
  return { ...base, ...overrides } as Requirements;
}

describe("rules engine — generateBrief", () => {
  it("returns a valid brief for a 2400 sqft 2-floor residential house", () => {
    const b = generateBrief(reqs());
    expect(b.projectType).toBe("residential_house");
    expect(b.summary.totalSqftPlot).toBe(2400);
    expect(b.summary.floors).toBe(2);
    expect(b.floors).toHaveLength(2);
    expect(b.floors[0].label).toBe("Ground floor");
    expect(b.floors[1].label).toBe("First floor");
  });

  it("places living + kitchen on the ground floor of a multi-floor home", () => {
    const b = generateBrief(reqs({ floors: 2 }));
    const groundTypes = b.floors[0].rooms.map((r) => r.type);
    expect(groundTypes).toContain("living");
    expect(groundTypes).toContain("kitchen");
    expect(groundTypes).toContain("dining");
  });

  it("distributes bedrooms across non-ground floors when floors > 1", () => {
    const b = generateBrief(
      reqs({ floors: 2, rooms: { bedrooms: 4, bathrooms: 4, kitchens: 1, livingRooms: 1, diningRooms: 1, studyRooms: 0, poojaRooms: 0, utilityRooms: 1, servantRooms: 0 } as any })
    );
    const groundBeds = b.floors[0].rooms.filter((r) => r.type === "bedroom" || r.type === "master_bedroom");
    const upperBeds = b.floors[1].rooms.filter((r) => r.type === "bedroom" || r.type === "master_bedroom");
    expect(groundBeds.length).toBe(0);
    expect(upperBeds.length).toBe(4);
  });

  it("designates a master bedroom on the top floor", () => {
    const b = generateBrief(reqs({ floors: 2 }));
    const masters = b.floors.flatMap((f) => f.rooms).filter((r) => r.type === "master_bedroom");
    expect(masters.length).toBe(1);
  });

  it("emits an FAR warning when planned area exceeds the cap", () => {
    const b = generateBrief(
      reqs({
        plot: { totalSqft: 800, maxFAR: 1.0 } as any,
        floors: 3,
        rooms: { bedrooms: 6, bathrooms: 4, kitchens: 1, livingRooms: 1, diningRooms: 1, studyRooms: 0, poojaRooms: 0, utilityRooms: 1, servantRooms: 0 } as any,
      })
    );
    expect(b.warnings.some((w) => /FAR cap/i.test(w))).toBe(true);
  });

  it("uses commercial layout (workstations, cabins, reception) for commercial_office", () => {
    const b = generateBrief(
      reqs({
        projectType: "commercial_office",
        floors: 2,
        commercial: {
          workstations: 40,
          cabins: 4,
          meetingRooms: 2,
          reception: true,
          cafeteria: true,
          retailUnits: 0,
        } as any,
      })
    );
    const allTypes = b.floors.flatMap((f) => f.rooms).map((r) => r.type);
    expect(allTypes).toContain("workstation_area");
    expect(allTypes).toContain("cabin");
    expect(allTypes).toContain("meeting_room");
    expect(allTypes).toContain("reception");
    expect(allTypes).toContain("cafeteria");
  });

  it("stacks mixed-use: retail on ground, residential above", () => {
    const b = generateBrief(
      reqs({
        projectType: "mixed_use",
        floors: 2,
        commercial: { workstations: 0, cabins: 0, meetingRooms: 0, reception: true, cafeteria: false, retailUnits: 2 } as any,
      })
    );
    const groundTypes = b.floors[0].rooms.map((r) => r.type);
    const upperTypes = b.floors[1].rooms.map((r) => r.type);
    expect(groundTypes).toContain("retail_unit");
    expect(groundTypes).toContain("reception");
    expect(upperTypes).toContain("bedroom");
  });

  it("includes a stairs entry on every floor when floors > 1", () => {
    const b = generateBrief(reqs({ floors: 3 }));
    for (const f of b.floors) {
      expect(f.rooms.some((r) => r.type === "stairs")).toBe(true);
    }
  });

  it("adds a lift when amenities.lift is true", () => {
    const b = generateBrief(reqs({ floors: 2, amenities: { balcony: true, terrace: true, garden: false, lift: true, solar: false, rainwater: false, pool: false, gym: false } as any }));
    const liftCount = b.floors.flatMap((f) => f.rooms).filter((r) => r.type === "lift").length;
    expect(liftCount).toBeGreaterThan(0);
  });

  it("populates per-room costs and a floor total", () => {
    const b = generateBrief(reqs());
    for (const f of b.floors) {
      expect(f.floorCostInr).toBeGreaterThan(0);
      for (const r of f.rooms) {
        expect(r.costInr).toBeGreaterThan(0);
        expect(r.costPerSqftInr).toBeGreaterThan(0);
      }
    }
  });

  it("charges more per sqft for kitchens than for bedrooms", () => {
    const b = generateBrief(reqs());
    const kitchen = b.floors.flatMap((f) => f.rooms).find((r) => r.type === "kitchen");
    const bedroom = b.floors.flatMap((f) => f.rooms).find((r) => r.type === "bedroom" || r.type === "master_bedroom");
    expect(kitchen).toBeDefined();
    expect(bedroom).toBeDefined();
    expect(kitchen!.costPerSqftInr!).toBeGreaterThan(bedroom!.costPerSqftInr!);
  });

  it("produces a cost estimate with low <= high", () => {
    const b = generateBrief(reqs());
    expect(b.costEstimateInr).toBeDefined();
    expect(b.costEstimateInr!.low).toBeLessThanOrEqual(b.costEstimateInr!.high);
    expect(b.costEstimateInr!.perSqftInr).toBeGreaterThan(0);
  });

  it("includes vastu and accessibility notes when requested", () => {
    const b = generateBrief(
      reqs({
        preferences: { style: "modern", climate: "tropical", vastuCompliant: true, accessibility: true, sustainable: false } as any,
      })
    );
    expect(b.codeNotes.some((n) => /vastu/i.test(n))).toBe(true);
    expect(b.codeNotes.some((n) => /accessib/i.test(n))).toBe(true);
  });

  it("duplicates rooms per unit in residential_apartment with unitsPerFloor > 1", () => {
    const b = generateBrief(
      reqs({
        projectType: "residential_apartment",
        floors: 2,
        unitsPerFloor: 3,
      })
    );
    // Ground floor should still have 3 sets of common-area rooms (one per unit)
    const livings = b.floors[0].rooms.filter((r) => r.type === "living").length;
    expect(livings).toBe(3);
    // Plus a shared lobby
    expect(b.floors[0].rooms.some((r) => r.type === "lobby")).toBe(true);
  });
});
