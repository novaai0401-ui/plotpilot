import { describe, it, expect } from "vitest";
import { bucketKey, bucketKeys, latestCompletedRange, periodLabel, previousRange } from "@/lib/insights/periods";

// Sunday 1 Nov 2026, 12:00 IST.
const NOW = new Date("2026-11-01T06:30:00Z");

describe("latestCompletedRange", () => {
  it("gives the last full Monday-to-Sunday week in IST", () => {
    const r = latestCompletedRange("week", NOW);
    expect(r.start.toISOString()).toBe("2026-10-18T18:30:00.000Z"); // Mon 19 Oct 00:00 IST
    expect(r.end.toISOString()).toBe("2026-10-25T18:30:00.000Z"); // Mon 26 Oct 00:00 IST
  });

  it("treats Monday morning IST as a new week even though it's still Sunday in UTC", () => {
    const mondayIst = new Date("2026-11-01T19:00:00Z"); // Mon 2 Nov 00:30 IST
    expect(latestCompletedRange("week", mondayIst).end.toISOString()).toBe("2026-11-01T18:30:00.000Z");
  });

  it("gives the previous calendar month, and rolls across a year boundary", () => {
    const r = latestCompletedRange("month", NOW);
    expect(r.start.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-31T18:30:00.000Z");

    const january = latestCompletedRange("month", new Date("2027-01-15T06:30:00Z"));
    expect(periodLabel("month", january)).toBe("Dec 2026");
  });

  it("gives the previous calendar year", () => {
    expect(periodLabel("year", latestCompletedRange("year", NOW))).toBe("2025");
  });
});

describe("previousRange", () => {
  it.each(["week", "month", "year"] as const)("%s ends exactly where the report starts", (kind) => {
    const r = latestCompletedRange(kind, NOW);
    expect(previousRange(kind, r).end).toEqual(r.start);
  });

  it("handles months of different lengths", () => {
    const march = latestCompletedRange("month", new Date("2027-04-10T06:30:00Z"));
    expect(periodLabel("month", previousRange("month", march))).toBe("Feb 2027");
  });
});

describe("buckets", () => {
  it("files 01:00 IST on the 1st under the 1st, not the previous UTC day", () => {
    expect(bucketKey("month", new Date("2026-09-30T19:30:00Z"))).toBe("2026-10-01");
  });

  it("creates one bucket per day or month", () => {
    expect(bucketKeys("week", latestCompletedRange("week", NOW))).toHaveLength(7);
    expect(bucketKeys("month", latestCompletedRange("month", NOW))).toHaveLength(31);
    const year = bucketKeys("year", latestCompletedRange("year", NOW));
    expect(year).toHaveLength(12);
    expect(year[0]).toBe("2025-01");
  });

  it("labels a week across a month end", () => {
    const r = { start: new Date("2026-09-27T18:30:00Z"), end: new Date("2026-10-04T18:30:00Z") };
    expect(periodLabel("week", r)).toBe("28 Sep – 4 Oct 2026");
  });
});
