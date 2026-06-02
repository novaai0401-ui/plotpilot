import type { OrgPlan } from "@prisma/client";

/**
 * Plan-tier model policy.
 *
 * The whole point of this file: brokers on the free tier should NEVER
 * accidentally burn LLM tokens. Pitches and valuations gracefully
 * degrade to deterministic fallbacks (template / per-sqft heuristic).
 *
 * Pro users get Haiku — roughly an order of magnitude cheaper than Sonnet
 * and more than capable for the WhatsApp-message and JSON-extraction tasks
 * we use it for. Enterprise gets Sonnet for valuations where the broker
 * actually wants the model's reasoning depth.
 *
 * Returning null means "use the deterministic fallback in the calling
 * module — don't call Anthropic at all."
 */

export type LlmKind = "pitch" | "valuation";

export type LlmModelChoice = {
  /** Anthropic model identifier, or null to skip the API entirely. */
  model: string | null;
  /** Max output tokens for this kind. Sized to typical use. */
  maxTokens: number;
  /** Where this policy decision came from — surfaced in audit logs. */
  reason: string;
};

const HAIKU = "claude-haiku-4-5"; // ~10x cheaper than sonnet, ample for our prompts
const SONNET = "claude-sonnet-4-5";

export function chooseModel(plan: OrgPlan, kind: LlmKind): LlmModelChoice {
  if (plan === "free") {
    return { model: null, maxTokens: 0, reason: "free plan — heuristic only" };
  }
  if (plan === "pro") {
    if (kind === "pitch") return { model: HAIKU, maxTokens: 350, reason: "pro plan — haiku for pitch" };
    if (kind === "valuation") return { model: HAIKU, maxTokens: 700, reason: "pro plan — haiku for valuation" };
  }
  // enterprise
  if (kind === "pitch") return { model: HAIKU, maxTokens: 350, reason: "enterprise plan — haiku for pitch (same as pro; sonnet is overkill)" };
  if (kind === "valuation") return { model: SONNET, maxTokens: 700, reason: "enterprise plan — sonnet for valuation (reasoning depth)" };
  return { model: null, maxTokens: 0, reason: "unknown" };
}

/**
 * Per-call estimated cost in INR. Wire-honest — used for usage-event logging
 * and budget checks. Conservative (rounds up).
 *
 * Rates as of 2026:
 *   Haiku 4.5:  ~$1/M input, ~$5/M output  → ₹0.0008/1K in, ₹0.0042/1K out
 *   Sonnet 4.5: ~$3/M input, ~$15/M output → ₹0.0025/1K in, ₹0.0125/1K out
 * Using ₹/USD = 83.
 */
const RATES_INR_PER_1K_TOKEN: Record<string, { input: number; output: number }> = {
  [HAIKU]: { input: 0.0664, output: 0.332 },
  [SONNET]: { input: 0.249, output: 1.245 },
};

export function estimateCostInr(
  model: string | null,
  inputTokens: number,
  outputTokens: number
): number {
  if (!model) return 0;
  const r = RATES_INR_PER_1K_TOKEN[model];
  if (!r) return 0;
  const cost = (inputTokens / 1000) * r.input + (outputTokens / 1000) * r.output;
  // Always round up to the next paisa so we err on the side of over-counting.
  return Math.ceil(cost * 100) / 100;
}

export const MODELS = { HAIKU, SONNET };
