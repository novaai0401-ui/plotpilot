import { describe, it, expect } from "vitest";
import { narrativeHash, renderHash } from "@/lib/architect/design-cache";
import { RequirementsSchema } from "@/lib/architect/requirements";

function req(overrides: any = {}) {
  return RequirementsSchema.parse({
    projectType: "residential_house",
    plot: { totalSqft: 2400 },
    ...overrides,
  });
}

describe("design-cache hashing", () => {
  describe("narrativeHash", () => {
    it("is deterministic for identical input", () => {
      const a = narrativeHash(req());
      const b = narrativeHash(req());
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/); // sha-256 hex
    });

    it("ignores lead-specific fields (notes do not affect the hash beyond the captured fields)", () => {
      // notes is NOT in canonicalizeForNarrative, so adding it should not change the hash.
      const a = narrativeHash(req());
      const b = narrativeHash(req({ notes: "completely different free-text notes" }));
      expect(a).toBe(b);
    });

    it("changes when project type changes", () => {
      const a = narrativeHash(req({ projectType: "residential_house" }));
      const b = narrativeHash(req({ projectType: "commercial_office" }));
      expect(a).not.toBe(b);
    });

    it("changes when floor count changes", () => {
      const a = narrativeHash(req({ floors: 2 }));
      const b = narrativeHash(req({ floors: 3 }));
      expect(a).not.toBe(b);
    });

    it("treats plot sizes within the same 100-sqft bucket as identical", () => {
      // canonicalizeForNarrative rounds plot.totalSqft to nearest 100
      const a = narrativeHash(req({ plot: { totalSqft: 2400 } }));
      const b = narrativeHash(req({ plot: { totalSqft: 2449 } }));
      expect(a).toBe(b);
      const c = narrativeHash(req({ plot: { totalSqft: 2500 } }));
      expect(a).not.toBe(c);
    });
  });

  describe("renderHash", () => {
    it("is deterministic for identical input", () => {
      expect(renderHash(req())).toBe(renderHash(req()));
    });

    it("groups plots into 500-sqft buckets (narrower than narrative)", () => {
      const a = renderHash(req({ plot: { totalSqft: 2400 } }));
      const b = renderHash(req({ plot: { totalSqft: 2499 } }));
      expect(a).toBe(b);
      const c = renderHash(req({ plot: { totalSqft: 2500 } }));
      expect(a).not.toBe(c);
    });

    it("does NOT change when room counts change (render only depends on style/type/floors/amenities)", () => {
      const a = renderHash(req({ rooms: { bedrooms: 3 } as any }));
      const b = renderHash(req({ rooms: { bedrooms: 5 } as any }));
      expect(a).toBe(b);
    });

    it("changes when style changes", () => {
      const a = renderHash(req({ preferences: { style: "modern" } as any }));
      const b = renderHash(req({ preferences: { style: "traditional" } as any }));
      expect(a).not.toBe(b);
    });

    it("changes when balcony amenity toggles", () => {
      const a = renderHash(req({ amenities: { balcony: true } as any }));
      const b = renderHash(req({ amenities: { balcony: false } as any }));
      expect(a).not.toBe(b);
    });
  });

  it("narrative and render hashes are different (different canonicalization)", () => {
    expect(narrativeHash(req())).not.toBe(renderHash(req()));
  });
});
