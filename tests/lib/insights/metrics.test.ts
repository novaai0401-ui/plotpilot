import { describe, it, expect } from "vitest";
import { computeMetrics, fallbackNarrative, type MetricsInput, type VisitRow } from "@/lib/insights/metrics";
import { latestCompletedRange, previousRange } from "@/lib/insights/periods";

const NOW = new Date("2026-11-01T06:30:00Z");
const range = latestCompletedRange("month", NOW); // Oct 2026
const previous = previousRange("month", range); // Sep 2026
const OCT = new Date("2026-10-10T06:30:00Z");
const SEP = new Date("2026-09-10T06:30:00Z");

function visit(over: Partial<VisitRow>): VisitRow {
  return {
    agentId: "a1",
    plotId: "p1",
    clientId: "c1",
    status: "completed",
    outcome: null,
    outcomeAt: null,
    scheduledAt: OCT,
    ...over,
  };
}

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    kind: "month",
    range,
    previous,
    events: [],
    visits: [],
    activity: [],
    agentNames: { a1: "Asha", a2: "Ravi" },
    plotTitles: { p1: "Palm Grove", p2: "Lake Road" },
    ...over,
  };
}

const kpi = (m: ReturnType<typeof computeMetrics>, key: string) => m.kpis.find((k) => k.key === key)!;

describe("computeMetrics", () => {
  it("compares the period with the one before it", () => {
    const m = computeMetrics(
      input({
        visits: [visit({}), visit({}), visit({}), visit({ scheduledAt: SEP }), visit({ scheduledAt: SEP })],
      })
    );
    expect(kpi(m, "visitsHeld")).toMatchObject({ value: 3, previous: 2, changePct: 50 });
  });

  it("reports no percentage when there's nothing to compare with", () => {
    const m = computeMetrics(input({ visits: [visit({})] }));
    expect(kpi(m, "visitsHeld").changePct).toBeNull();
  });

  it("counts a booking when it was decided, not when the visit happened", () => {
    const m = computeMetrics(
      input({ visits: [visit({ scheduledAt: SEP, outcome: "booked", outcomeAt: OCT })] })
    );
    expect(kpi(m, "bookings").value).toBe(1);
    expect(kpi(m, "visitsHeld").value).toBe(0);
  });

  it("calculates no-show rate from attended and missed visits only", () => {
    const m = computeMetrics(
      input({
        visits: [
          visit({}),
          visit({}),
          visit({}),
          visit({ status: "no_show" }),
          visit({ status: "cancelled" }),
          visit({ status: "scheduled" }),
        ],
      })
    );
    expect(kpi(m, "noShowRate").value).toBe(25);
    expect(kpi(m, "noShowRate").lowerIsBetter).toBe(true);
  });

  it("doesn't count an opened WhatsApp link as a sent message", () => {
    const m = computeMetrics(
      input({
        events: [
          { type: "message.sent", createdAt: OCT, metadata: { channel: "whatsapp_deeplink" } },
          { type: "message.sent", createdAt: OCT, metadata: { channel: "whatsapp_api" } },
        ],
      })
    );
    expect(kpi(m, "messagesSent").value).toBe(1);
    expect(kpi(m, "messagesPrepared").value).toBe(1);
  });

  it("builds the funnel with stage-to-stage rates", () => {
    const m = computeMetrics(
      input({
        events: [
          { type: "invitation.sent", createdAt: OCT },
          { type: "invitation.sent", createdAt: OCT },
          { type: "invitation.accepted", createdAt: OCT },
        ],
        visits: [visit({ outcome: "booked", outcomeAt: OCT })],
      })
    );
    expect(m.funnel.map((s) => [s.count, s.ratePct])).toEqual([
      [2, null],
      [1, 50],
      [1, 100],
      [1, 100],
    ]);
  });

  it("leaves out a stage rate over 100%, which wouldn't be a real conversion", () => {
    const m = computeMetrics(
      input({
        events: [{ type: "invitation.accepted", createdAt: OCT }],
        visits: [visit({}), visit({}), visit({})],
      })
    );
    expect(m.funnel.find((s) => s.key === "visited")).toMatchObject({ count: 3, ratePct: null });
  });

  it("fills quiet days with zeros and places activity on the right day", () => {
    const m = computeMetrics(input({ visits: [visit({})] }));
    expect(m.timeline).toHaveLength(31);
    expect(m.timeline.find((d) => d.day === "2026-10-10")?.Visits).toBe(1);
    expect(m.timeline.find((d) => d.day === "2026-10-11")?.Visits).toBe(0);
  });

  it("ranks agents by bookings and plots by bookings then visits", () => {
    const m = computeMetrics(
      input({
        visits: [
          visit({ agentId: "a1", plotId: "p1" }),
          visit({ agentId: "a1", plotId: "p1" }),
          visit({ agentId: "a2", plotId: "p2", outcome: "booked", outcomeAt: OCT }),
        ],
      })
    );
    expect(m.agents[0]).toMatchObject({ name: "Ravi", bookings: 1 });
    expect(m.plots[0]).toMatchObject({ title: "Lake Road", bookings: 1 });
  });

  it("counts active staff and only sections from the period", () => {
    const m = computeMetrics(
      input({
        activity: [
          { userId: "a1", path: "/dashboard/plots", createdAt: OCT },
          { userId: "a1", path: "/dashboard/plots", createdAt: OCT },
          { userId: "a2", path: "/dashboard", createdAt: OCT },
          { userId: "a3", path: "/dashboard", createdAt: SEP },
        ],
      })
    );
    expect(m.activeStaff).toBe(2);
    expect(m.sections[0]).toEqual({ path: "/dashboard/plots", views: 2 });
  });

  it("flags an empty period even if the previous one had activity", () => {
    expect(computeMetrics(input({ visits: [visit({ scheduledAt: SEP })] })).isEmpty).toBe(true);
  });
});

describe("fallbackNarrative", () => {
  it("states figures from the metrics", () => {
    const m = computeMetrics(
      input({
        visits: [visit({ outcome: "booked", outcomeAt: OCT }), visit({ scheduledAt: SEP }), visit({ scheduledAt: SEP })],
      })
    );
    const text = fallbackNarrative(m);
    expect(text).toContain("1 booking from 1 visit held");
    expect(text).toContain("down 50%");
    expect(text).toContain("Palm Grove");
  });

  it("writes the summary in Hindi and Marathi", () => {
    const m = computeMetrics(input({ visits: [visit({ outcome: "booked", outcomeAt: OCT })] }));
    expect(fallbackNarrative(m, "hi")).toContain("अक्टू 2026: 1 विज़िट से 1 बुकिंग");
    expect(fallbackNarrative(m, "mr")).toContain("ऑक्टो 2026: 1 भेट मधून 1 बुकिंग");
  });

  it("says so plainly when nothing happened", () => {
    expect(fallbackNarrative(computeMetrics(input()))).toBe("No recorded activity for Oct 2026.");
  });
});
