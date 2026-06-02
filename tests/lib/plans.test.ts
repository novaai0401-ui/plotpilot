import { describe, it, expect } from "vitest";
import { planCaps, PLAN_CAPABILITIES, PUBLIC_FLOW_CAPABILITIES } from "@/lib/plans";

describe("plan capabilities table", () => {
  it("free plan has no AI features", () => {
    const c = planCaps("free");
    expect(c.llmNarrative).toBe(false);
    expect(c.aiRender).toBe(false);
    expect(c.whatsappBusinessApi).toBe(false);
    expect(c.priceInr).toBe(0);
  });

  it("pro plan unlocks LLM narrative but not render or business api", () => {
    const c = planCaps("pro");
    expect(c.llmNarrative).toBe(true);
    expect(c.aiRender).toBe(false);
    expect(c.whatsappBusinessApi).toBe(false);
    expect(c.priceInr).toBeGreaterThan(0);
  });

  it("enterprise plan unlocks everything", () => {
    const c = planCaps("enterprise");
    expect(c.llmNarrative).toBe(true);
    expect(c.aiRender).toBe(true);
    expect(c.whatsappBusinessApi).toBe(true);
  });

  it("caps scale monotonically across tiers", () => {
    expect(PLAN_CAPABILITIES.free.monthlyDesignsCap).toBeLessThan(PLAN_CAPABILITIES.pro.monthlyDesignsCap);
    expect(PLAN_CAPABILITIES.pro.monthlyDesignsCap).toBeLessThan(PLAN_CAPABILITIES.enterprise.monthlyDesignsCap);
    expect(PLAN_CAPABILITIES.free.monthlyLeadAlertsCap).toBeLessThan(PLAN_CAPABILITIES.pro.monthlyLeadAlertsCap);
    expect(PLAN_CAPABILITIES.pro.monthlyLeadAlertsCap).toBeLessThan(PLAN_CAPABILITIES.enterprise.monthlyLeadAlertsCap);
  });

  it("public-flow capabilities allow LLM + render (platform-funded)", () => {
    expect(PUBLIC_FLOW_CAPABILITIES.llmNarrative).toBe(true);
    expect(PUBLIC_FLOW_CAPABILITIES.aiRender).toBe(true);
  });
});
