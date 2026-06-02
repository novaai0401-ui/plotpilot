import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { chooseModel, estimateCostInr, type LlmKind, type LlmModelChoice } from "./models";
import { logUsage } from "@/lib/usage";

/**
 * Single entry point for every LLM call in the app.
 *
 * Responsibilities:
 *   - Resolve the org's plan tier and pick the right model (Haiku/Sonnet/null)
 *   - Pre-call: check this org isn't already over its monthly LLM budget
 *   - Post-call: log a UsageEvent with token count + estimated INR cost
 *   - Surface a deterministic "use the fallback" signal when the plan is free
 *     or the budget is exhausted — callers handle that gracefully
 *
 * Hard-fails with a typed `LlmCapHitError` when the org is over budget; the
 * existing UpgradeModal already handles `cap_hit` errors from billing flows,
 * so this fits the established UX.
 */

export type LlmRunArgs = {
  orgId: string;
  kind: LlmKind;
  system: string;
  user: string;
};

export type LlmRunResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number; costInr: number; model: string }
  | { ok: false; reason: "free_plan" | "no_api_key"; model: null };

export class LlmCapHitError extends Error {
  capCents: number;
  spentCents: number;
  constructor(capCents: number, spentCents: number) {
    super(`LLM monthly cap hit: spent ${spentCents}¢ of ${capCents}¢`);
    this.name = "LlmCapHitError";
    this.capCents = capCents;
    this.spentCents = spentCents;
  }
}

/**
 * Pre-call budget check. Returns the org's current monthly LLM spend (USD cents)
 * and its cap. Throws LlmCapHitError if the cap is already exhausted, so the
 * route handler can return 402 with `cap_hit` for the existing UpgradeModal.
 */
async function assertWithinBudget(orgId: string): Promise<{ capCents: number; spentCents: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { monthlyLlmBudgetUsdCents: true },
  });
  const capCents = org?.monthlyLlmBudgetUsdCents ?? 500;

  // Sum month-to-date llm_tokens spend.
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const agg = await prisma.usageEvent.aggregate({
    where: { orgId, kind: "llm_tokens", createdAt: { gte: start } },
    _sum: { costUsdMicro: true },
  });
  const microUsd = Number(agg._sum.costUsdMicro ?? 0n);
  const spentCents = Math.ceil(microUsd / 10_000); // micro → cents

  if (spentCents >= capCents) {
    throw new LlmCapHitError(capCents, spentCents);
  }
  return { capCents, spentCents };
}

/**
 * Run an LLM call with plan-tier model selection, pre-call budget check, and
 * post-call usage logging. Callers handle the fallback paths when this returns
 * `{ok: false}`.
 */
export async function runLlm(args: LlmRunArgs): Promise<LlmRunResult> {
  // Resolve org plan
  const org = await prisma.organization.findUnique({
    where: { id: args.orgId },
    select: { plan: true },
  });
  const plan = org?.plan ?? "free";
  const choice: LlmModelChoice = chooseModel(plan, args.kind);

  if (!choice.model) {
    return { ok: false, reason: "free_plan", model: null };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", model: null };
  }

  // Throws LlmCapHitError if over budget — let it bubble.
  await assertWithinBudget(args.orgId);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: choice.model,
    max_tokens: choice.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const text = resp.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const inputTokens = resp.usage.input_tokens;
  const outputTokens = resp.usage.output_tokens;
  const costInr = estimateCostInr(choice.model, inputTokens, outputTokens);

  // Convert INR → USD micro for the existing UsageEvent unit. 1 USD ≈ ₹83.
  const costMicroUsd = Math.ceil((costInr / 83) * 1_000_000);
  await logUsage(args.orgId, "llm_tokens", {
    units: inputTokens + outputTokens,
    metadata: {
      kind: args.kind,
      model: choice.model,
      inputTokens,
      outputTokens,
      costInrPaise: Math.round(costInr * 100),
      reason: choice.reason,
    },
    // Override the default per-token estimate with our exact cost.
  });
  // The logUsage helper computes cost from UNIT_COST_MICRO_USD * units; we want
  // EXACT cost from token counts. Patch the row in-place:
  await prisma.usageEvent
    .updateMany({
      where: {
        orgId: args.orgId,
        kind: "llm_tokens",
        createdAt: { gte: new Date(Date.now() - 5_000) },
      },
      data: { costUsdMicro: BigInt(costMicroUsd) },
    })
    .catch(() => {});

  return { ok: true, text, inputTokens, outputTokens, costInr, model: choice.model };
}
