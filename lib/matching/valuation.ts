import { createHash } from "crypto";
import type { Plot } from "@prisma/client";
import { runLlm } from "@/lib/llm/client";
import { getLlmCache, setLlmCache } from "@/lib/llm/cache";

export type ValuationInput = {
  orgId: string;
  plot: Pick<
    Plot,
    "title" | "location" | "city" | "lat" | "lng" | "sizeSqft" | "priceInr" | "description" | "status"
  >;
};

export type ValuationResult = {
  estimatedInr: number;
  lowEnd: number;
  highEnd: number;
  confidence: "low" | "medium" | "high";
  pricePerSqftInr: number | null;
  premiumFactors: string[];
  discountFactors: string[];
  reasoning: string;
  cacheHit: boolean;
  cacheKey: string;
  askingVsEstimate: "above" | "below" | "within" | "no-asking-price";
  /** True if served from deterministic fallback (free plan / no key / cap). */
  isFallback: boolean;
  fallbackReason?: "free_plan" | "no_api_key" | "cap_hit";
};

const VALUATION_SYSTEM_PROMPT = `You are a senior real-estate appraiser estimating fair-market value of an Indian residential / commercial plot.

Output STRICT JSON matching this TypeScript type — no preamble, no markdown:

{
  "estimatedInr": number,
  "lowEnd": number,
  "highEnd": number,
  "confidence": "low" | "medium" | "high",
  "pricePerSqftInr": number | null,
  "premiumFactors": string[],
  "discountFactors": string[],
  "reasoning": string
}

Reasoning principles:
- Anchor on per-sqft rates typical for the location/city. Indian metro residential plot land:
  Bangalore outskirts ₹3K-₹8K/sqft, prime areas ₹15K-₹30K/sqft.
  Mumbai suburbs ₹10K-₹40K/sqft, prime ₹40K+/sqft.
  Smaller cities ₹1K-₹4K/sqft.
- Adjust for: location specificity (gated layout = premium), corner plot, road width, BMRDA/RERA approval, facing, surrounding infrastructure.
- Confidence "high" if location is specific + size known + description substantive; "medium" if 2 of 3; "low" otherwise.
- Range tighter for "high" (±10%), wider for "low" (±35%).
- Rupee amounts MUST be whole numbers.
- premiumFactors / discountFactors: 1-4 items each.
- reasoning: 2-3 sentences.`;

export function valuationCacheKey(input: ValuationInput): string {
  const sig = {
    location: input.plot.location,
    city: input.plot.city,
    sizeSqft: input.plot.sizeSqft,
    desc: input.plot.description,
    status: input.plot.status,
  };
  return createHash("sha256")
    .update(JSON.stringify(sig, Object.keys(sig).sort()))
    .digest("hex")
    .slice(0, 24);
}

type ValuationCore = Omit<ValuationResult, "cacheHit" | "cacheKey" | "askingVsEstimate" | "isFallback" | "fallbackReason">;

export async function generateValuation(input: ValuationInput): Promise<ValuationResult> {
  const cacheKey = valuationCacheKey(input);

  // 1. Persistent cache hit.
  const cached = await getLlmCache<ValuationCore>("valuation", cacheKey);
  if (cached.cacheHit) {
    return {
      ...cached.value,
      cacheHit: true,
      cacheKey,
      askingVsEstimate: compareAsking(cached.value, input.plot.priceInr),
      isFallback: false,
    };
  }

  const userMessage =
    `Estimate fair-market value for this plot:\n` +
    `  Title: ${input.plot.title}\n` +
    `  Location: ${input.plot.location}\n` +
    `  City: ${input.plot.city || "(not stated)"}\n` +
    `  Coordinates: ${input.plot.lat && input.plot.lng ? `${input.plot.lat}, ${input.plot.lng}` : "(not stated)"}\n` +
    `  Size: ${input.plot.sizeSqft ? `${input.plot.sizeSqft} sqft` : "(not stated)"}\n` +
    `  Status: ${input.plot.status}\n` +
    (input.plot.description ? `  Description: ${input.plot.description}\n` : "");

  try {
    const result = await runLlm({
      orgId: input.orgId,
      kind: "valuation",
      system: VALUATION_SYSTEM_PROMPT,
      user: userMessage,
    });

    if (!result.ok) {
      const fb = fallbackValuation(input);
      return {
        ...fb,
        cacheHit: false,
        cacheKey,
        askingVsEstimate: compareAsking(fb, input.plot.priceInr),
        isFallback: true,
        fallbackReason: result.reason,
      };
    }

    // Parse Claude's JSON. Tolerate accidental ```json fences.
    const cleaned = result.text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
    let parsed: ValuationCore;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const fb = fallbackValuation(input);
      return {
        ...fb,
        cacheHit: false,
        cacheKey,
        askingVsEstimate: compareAsking(fb, input.plot.priceInr),
        isFallback: true,
        fallbackReason: "no_api_key", // parse failure — treat as if no model
      };
    }

    await setLlmCache("valuation", cacheKey, parsed, input.orgId);

    return {
      ...parsed,
      cacheHit: false,
      cacheKey,
      askingVsEstimate: compareAsking(parsed, input.plot.priceInr),
      isFallback: false,
    };
  } catch (e: any) {
    const fb = fallbackValuation(input);
    if (e?.name === "LlmCapHitError") {
      return {
        ...fb,
        cacheHit: false,
        cacheKey,
        askingVsEstimate: compareAsking(fb, input.plot.priceInr),
        isFallback: true,
        fallbackReason: "cap_hit",
      };
    }
    return {
      ...fb,
      cacheHit: false,
      cacheKey,
      askingVsEstimate: compareAsking(fb, input.plot.priceInr),
      isFallback: true,
      fallbackReason: "no_api_key",
    };
  }
}

function compareAsking(
  v: Pick<ValuationResult, "lowEnd" | "highEnd">,
  askingInr: number | null
): ValuationResult["askingVsEstimate"] {
  if (!askingInr) return "no-asking-price";
  if (askingInr < v.lowEnd) return "below";
  if (askingInr > v.highEnd) return "above";
  return "within";
}

/**
 * Honest fallback: per-sqft-rate × size + 30% confidence band. Free-plan
 * orgs see this; the UI badges it as "heuristic estimate" so brokers don't
 * mistake it for an LLM-reasoned figure.
 */
function fallbackValuation(input: ValuationInput): ValuationCore {
  const sqft = input.plot.sizeSqft ?? 1200;
  const cityLower = (input.plot.city || "").toLowerCase();
  const baseRate = cityLower.includes("mumbai")
    ? 18_000
    : cityLower.includes("bangalore") || cityLower.includes("bengaluru")
      ? 6_500
      : cityLower.includes("delhi") || cityLower.includes("noida") || cityLower.includes("gurgaon")
        ? 9_000
        : cityLower.includes("hyderabad") || cityLower.includes("chennai") || cityLower.includes("pune")
          ? 5_500
          : 3_000;
  const estimatedInr = Math.round(baseRate * sqft);
  return {
    estimatedInr,
    lowEnd: Math.round(estimatedInr * 0.7),
    highEnd: Math.round(estimatedInr * 1.3),
    confidence: "low",
    pricePerSqftInr: baseRate,
    premiumFactors: [],
    discountFactors: ["Heuristic estimate — upgrade to Pro for AI-reasoned valuation"],
    reasoning:
      `Per-sqft anchor estimate using a typical rate for ${input.plot.city || "the area"} ` +
      `(₹${baseRate.toLocaleString("en-IN")}/sqft). ` +
      `For a model-reasoned estimate with premium/discount factors, upgrade to Pro.`,
  };
}
