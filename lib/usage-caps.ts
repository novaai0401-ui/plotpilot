import { prisma } from "@/lib/db/prisma";
import { planCaps, type PlanCapabilities } from "@/lib/plans";
import type { OrgPlan } from "@prisma/client";

export type CapCheckResult =
  | { ok: true; remaining: number; cap: number }
  | {
      ok: false;
      reason: "monthly_designs_cap" | "monthly_lead_alerts_cap" | "feature_not_in_plan";
      message: string;
      currentPlan: OrgPlan;
      currentPlanLabel: string;
      suggestUpgradeTo: OrgPlan | null;
      cap: number;
      used: number;
    };

function monthStart(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function checkMonthlyDesignsCap(orgId: string): Promise<CapCheckResult> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  if (!org) {
    return {
      ok: false,
      reason: "monthly_designs_cap",
      message: "Org not found",
      currentPlan: "free",
      currentPlanLabel: "Free",
      suggestUpgradeTo: null,
      cap: 0,
      used: 0,
    };
  }
  const caps = planCaps(org.plan);
  const used = await prisma.buildingDesign.count({
    where: { orgId, createdAt: { gte: monthStart() } },
  });
  if (used >= caps.monthlyDesignsCap) {
    return {
      ok: false,
      reason: "monthly_designs_cap",
      message: `You've used ${used} of ${caps.monthlyDesignsCap} designs this month on the ${caps.label} plan.`,
      currentPlan: org.plan,
      currentPlanLabel: caps.label,
      suggestUpgradeTo: suggestNext(org.plan),
      cap: caps.monthlyDesignsCap,
      used,
    };
  }
  return { ok: true, remaining: caps.monthlyDesignsCap - used, cap: caps.monthlyDesignsCap };
}

export function suggestNext(plan: OrgPlan): OrgPlan | null {
  if (plan === "free") return "pro";
  if (plan === "pro") return "enterprise";
  return null;
}

/**
 * Single helper for the hot path (architect/generate). Returns the cap check + the
 * effective plan capabilities so the caller doesn't have to look them up twice.
 */
export async function preflightDesignGeneration(orgId: string): Promise<{
  cap: CapCheckResult;
  caps: PlanCapabilities;
}> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const caps = planCaps(org?.plan ?? "free");
  const cap = await checkMonthlyDesignsCap(orgId);
  return { cap, caps };
}
