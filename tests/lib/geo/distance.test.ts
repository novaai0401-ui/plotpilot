import { describe, it, expect } from "vitest";
import { distanceKm, cityMatches } from "@/lib/geo/distance";

describe("distanceKm (Haversine)", () => {
  it("returns 0 for identical points", () => {
    expect(distanceKm({ lat: 12.97, lng: 77.59 }, { lat: 12.97, lng: 77.59 })).toBe(0);
  });

  it("computes Bangalore → Delhi ≈ 1740 km (within 1%)", () => {
    const bangalore = { lat: 12.9716, lng: 77.5946 };
    const delhi = { lat: 28.7041, lng: 77.1025 };
    const d = distanceKm(bangalore, delhi);
    expect(d).toBeGreaterThan(1720);
    expect(d).toBeLessThan(1760);
  });

  it("computes Mumbai → Bangalore ≈ 840 km (within 1%)", () => {
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const bangalore = { lat: 12.9716, lng: 77.5946 };
    const d = distanceKm(mumbai, bangalore);
    expect(d).toBeGreaterThan(830);
    expect(d).toBeLessThan(850);
  });

  it("is symmetric (a→b === b→a)", () => {
    const a = { lat: 28.7, lng: 77.1 };
    const b = { lat: 12.97, lng: 77.59 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 5);
  });
});

describe("cityMatches", () => {
  it("matches identical strings case-insensitively", () => {
    expect(cityMatches("Bangalore", "bangalore")).toBe(true);
    expect(cityMatches("BANGALORE", "Bangalore")).toBe(true);
  });

  it("matches substrings in either direction", () => {
    expect(cityMatches("Bangalore", "Bangalore South")).toBe(true);
    expect(cityMatches("Bangalore Urban", "Bangalore")).toBe(true);
  });

  it("returns false for unrelated cities", () => {
    expect(cityMatches("Bangalore", "Delhi")).toBe(false);
    expect(cityMatches("Mumbai", "Pune")).toBe(false);
  });

  it("returns false when either side is missing or trivially short", () => {
    expect(cityMatches(null, "Bangalore")).toBe(false);
    expect(cityMatches("Bangalore", undefined)).toBe(false);
    expect(cityMatches("", "Bangalore")).toBe(false);
    expect(cityMatches("ab", "abx")).toBe(false); // < 3 chars
  });
});
