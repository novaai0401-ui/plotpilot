import type { OrgPlan } from "@prisma/client";

/**
 * Per-plan feature gates. Free plans get the deterministic rules engine only —
 * zero variable cost. Paid plans unlock paid AI features and have higher caps.
 *
 * Update prices here when adjusting tiers. The Settings page reads these so
 * brokers can see what they get on each plan.
 */

export type PlanCapabilities = {
  /** Use Claude to generate narrative? */
  llmNarrative: boolean;
  /** Use Replicate to generate exterior render? */
  aiRender: boolean;
  /** Allow Business API WhatsApp sends (otherwise deeplink-only). */
  whatsappBusinessApi: boolean;
  /** Max designs per month (soft cap; over-cap = grace + warning). */
  monthlyDesignsCap: number;
  /** Max number of public leads notifiable per month. */
  monthlyLeadAlertsCap: number;
  /** Public-facing label */
  label: string;
  /** Monthly price in INR (display only — wire to Stripe later). */
  priceInr: number;
};

export const PLAN_CAPABILITIES: Record<OrgPlan, PlanCapabilities> = {
  free: {
    llmNarrative: false,
    aiRender: false,
    whatsappBusinessApi: false,
    monthlyDesignsCap: 25,
    monthlyLeadAlertsCap: 10,
    label: "Free",
    priceInr: 0,
  },
  pro: {
    llmNarrative: true,
    aiRender: false,
    whatsappBusinessApi: false,
    monthlyDesignsCap: 250,
    monthlyLeadAlertsCap: 100,
    label: "Pro",
    priceInr: 1499,
  },
  enterprise: {
    llmNarrative: true,
    aiRender: true,
    whatsappBusinessApi: true,
    monthlyDesignsCap: 10_000,
    monthlyLeadAlertsCap: 5_000,
    label: "Enterprise",
    priceInr: 9999,
  },
};

export function planCaps(plan: OrgPlan): PlanCapabilities {
  return PLAN_CAPABILITIES[plan] ?? PLAN_CAPABILITIES.free;
}

/**
 * Public/anonymous flow uses the platform's default capabilities (we pay).
 * Decoupled from broker plans because the lead doesn't have one yet.
 */
export const PUBLIC_FLOW_CAPABILITIES: PlanCapabilities = {
  llmNarrative: true,
  aiRender: true,
  whatsappBusinessApi: false,
  monthlyDesignsCap: 100_000,
  monthlyLeadAlertsCap: 100_000,
  label: "Public",
  priceInr: 0,
};
