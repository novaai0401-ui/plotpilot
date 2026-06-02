import { createHash } from "crypto";
import type { Plot, User } from "@prisma/client";
import type { ClientPreferences } from "./preferences";
import { summarizePreferences } from "./preferences";
import { runLlm } from "@/lib/llm/client";
import { getLlmCache, setLlmCache } from "@/lib/llm/cache";

export type PitchInput = {
  orgId: string;
  plot: Pick<Plot, "title" | "location" | "city" | "sizeSqft" | "priceInr" | "description">;
  broker: Pick<User, "name">;
  client: Pick<User, "name">;
  preferences: ClientPreferences | null;
  /** Optional context the broker can pass in — last conversation summary, etc. */
  brokerNote?: string;
};

export type PitchResult = {
  text: string;
  cacheHit: boolean;
  cacheKey: string;
  /** True if the deterministic fallback was used (free plan, no API key, or budget cap). */
  isFallback: boolean;
  /** Why the fallback fired, if it did. */
  fallbackReason?: "free_plan" | "no_api_key" | "cap_hit";
};

export function pitchCacheKey(input: PitchInput): string {
  const sig = {
    plotTitle: input.plot.title,
    plotLocation: input.plot.location,
    plotSize: input.plot.sizeSqft,
    plotPrice: input.plot.priceInr,
    plotDesc: input.plot.description,
    client: input.client.name,
    prefs: input.preferences,
    brokerNote: input.brokerNote || null,
  };
  return createHash("sha256").update(JSON.stringify(sig, Object.keys(sig).sort())).digest("hex").slice(0, 24);
}

const PITCH_SYSTEM_PROMPT = `You are an Indian real-estate broker drafting a SHORT WhatsApp message to a specific buyer about a specific plot.

Rules:
- 60–110 words. Plain text only — no markdown, no links, no emoji storms (max 2 emojis).
- Open with the buyer's first name. Sign off with the broker's first name.
- Lead with the ONE strongest match reason from their preferences (location, budget fit, size, or a must-have).
- Quote the price in lakhs / crores (Indian convention: ₹75L for ₹75,00,000).
- Mention plot size in sqft.
- Propose ONE next step (a visit time, a quick call). Don't ask vague "let me know if interested" — be concrete.
- No invented features. Only use facts from the plot and preferences in the input.
- No clichés like "great investment", "lifetime opportunity", "must see".

Output the WhatsApp body only. No preamble, no explanation.`;

export async function generatePitch(input: PitchInput): Promise<PitchResult> {
  const cacheKey = pitchCacheKey(input);

  // 1. Persistent cache hit — zero cost, instant.
  const cached = await getLlmCache<{ text: string }>("pitch", cacheKey);
  if (cached.cacheHit) {
    return { text: cached.value.text, cacheHit: true, cacheKey, isFallback: false };
  }

  // 2. Build the user message
  const userMessage = buildUserMessage(input);

  // 3. Try the real LLM via the cost-controlled runner.
  try {
    const result = await runLlm({
      orgId: input.orgId,
      kind: "pitch",
      system: PITCH_SYSTEM_PROMPT,
      user: userMessage,
    });
    if (result.ok) {
      await setLlmCache("pitch", cacheKey, { text: result.text }, input.orgId);
      return { text: result.text, cacheHit: false, cacheKey, isFallback: false };
    }
    // Graceful degradation: free plan or missing API key.
    return {
      text: fallbackPitch(input),
      cacheHit: false,
      cacheKey,
      isFallback: true,
      fallbackReason: result.reason,
    };
  } catch (e: any) {
    if (e?.name === "LlmCapHitError") {
      return {
        text: fallbackPitch(input),
        cacheHit: false,
        cacheKey,
        isFallback: true,
        fallbackReason: "cap_hit",
      };
    }
    // Unknown LLM failure — still return the fallback so the UI keeps working.
    return {
      text: fallbackPitch(input),
      cacheHit: false,
      cacheKey,
      isFallback: true,
      fallbackReason: "no_api_key",
    };
  }
}

function buildUserMessage(input: PitchInput): string {
  return (
    `Plot:\n` +
    `  Title: ${input.plot.title}\n` +
    `  Location: ${input.plot.location}${input.plot.city ? ` (${input.plot.city})` : ""}\n` +
    `  Size: ${input.plot.sizeSqft ? `${input.plot.sizeSqft} sqft` : "size not stated"}\n` +
    `  Price: ${input.plot.priceInr ? `₹${input.plot.priceInr.toLocaleString("en-IN")}` : "price not stated"}\n` +
    (input.plot.description ? `  Description: ${input.plot.description}\n` : "") +
    `\n` +
    `Buyer: ${input.client.name}\n` +
    `Their preferences: ${summarizePreferences(input.preferences)}\n` +
    (input.preferences?.notes ? `Broker's notes about this buyer: ${input.preferences.notes}\n` : "") +
    (input.brokerNote ? `Broker's recent context: ${input.brokerNote}\n` : "") +
    `\n` +
    `Broker (signing off as): ${input.broker.name}`
  );
}

/**
 * Deterministic last-resort pitch. Always usable — covers free-plan orgs,
 * cold deploys without ANTHROPIC_API_KEY, and budget-cap-hit states.
 *
 * Honest about what it is: builds a workable template from the structured
 * data we already have. The broker can edit before sending.
 */
function fallbackPitch(input: PitchInput): string {
  const firstName = input.client.name.split(" ")[0] || input.client.name;
  const brokerFirst = input.broker.name.split(" ")[0] || input.broker.name;
  const sizeFrag = input.plot.sizeSqft ? `${input.plot.sizeSqft} sqft` : "this plot";
  const priceFrag = input.plot.priceInr
    ? `₹${(input.plot.priceInr / 100_000).toFixed(1)}L`
    : "asking price on request";
  const locationFrag =
    input.plot.city || input.plot.location.split("—")[0]?.trim() || input.plot.location;

  // If the buyer specified a budget and the plot fits, lead with that.
  let opening = `Hi ${firstName}, sharing a plot that might fit what you mentioned`;
  if (input.preferences?.budgetInrMax && input.plot.priceInr && input.plot.priceInr <= input.preferences.budgetInrMax) {
    opening = `Hi ${firstName}, found one that's well within your budget`;
  } else if (input.preferences?.location && input.plot.city) {
    const want = input.preferences.location.toLowerCase();
    if (want.includes(input.plot.city.toLowerCase())) {
      opening = `Hi ${firstName}, this one's right in ${input.plot.city}`;
    }
  }

  return (
    `${opening} — ` +
    `${sizeFrag} in ${locationFrag}, ${priceFrag}. ` +
    `Happy to walk you through it this week — what day works? ` +
    `– ${brokerFirst}`
  );
}
