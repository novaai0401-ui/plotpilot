import Anthropic from "@anthropic-ai/sdk";
import type { Requirements } from "./requirements";
import type { DesignBrief } from "./rules";
import { getCachedNarrative, setCachedNarrative } from "./design-cache";
import { fallbackNarrative } from "./fallback-narrative";
import type { Locale } from "@/lib/i18n/dict";
import { logUsage } from "@/lib/usage";

/**
 * LLM enrichment: takes the deterministic brief from the rules engine and
 * generates a descriptive narrative, design rationale, and personalized
 * recommendations. Returns plain markdown text.
 *
 * Graceful degradation: if ANTHROPIC_API_KEY is missing, returns a synthesized
 * fallback so the page still renders end-to-end.
 */

const MODEL = "claude-sonnet-4-5";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "Hindi, in Devanagari script",
  mr: "Marathi, in Devanagari script",
};

export type NarrativeResult = {
  text: string;
  cacheHit: boolean;
  costMicroUsd: number;
  fallback?: boolean;
};

export async function generateNarrative(
  req: Requirements,
  brief: DesignBrief,
  orgId?: string | null,
  locale: Locale = "en"
): Promise<NarrativeResult> {
  const fallback = (): NarrativeResult => ({
    text: fallbackNarrative(req, brief, "en"),
    cacheHit: false,
    costMicroUsd: 0,
    fallback: true,
  });

  // Cache first — same requirements pattern within 30 days = zero cost
  const cached = await getCachedNarrative(req, locale);
  if (cached) {
    if (orgId) await logUsage(orgId, "llm_tokens", { freeOfCharge: true, metadata: { cache: "hit" } });
    return { text: cached, cacheHit: true, costMicroUsd: 0 };
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system = `You are an experienced architect writing a design brief for a client.
You receive a structured set of requirements AND a deterministic design specification (room list, dimensions, materials).
Your job is to translate this into a warm, professional 400-600 word narrative that explains:
1. The overall design philosophy you'd take for this project (1 paragraph).
2. How the layout flows — major design moves and why (2-3 paragraphs).
3. Personalized recommendations the client should consider beyond what's in the brief (1 paragraph).
4. Three actionable next steps.

Write in clear, jargon-light language, in the language the user message asks for. Use four markdown headings: ## Overview, ## Layout & flow, ## Recommendations, ## Next steps, with the headings written in that same language.
Do NOT repeat the raw numbers/tables — the user already sees those. Focus on *why* and *how it feels to live/work in*.`;

  const userMessage = `## Requirements
\`\`\`json
${JSON.stringify(req, null, 2)}
\`\`\`

## Computed brief (rules engine output)
\`\`\`json
${JSON.stringify(
  {
    projectType: brief.projectType,
    summary: brief.summary,
    floorCount: brief.floors.length,
    floorAreas: brief.floors.map((f) => ({ label: f.label, netSqft: f.netSqft })),
    materials: brief.materials,
    mep: brief.mep,
    codeNotes: brief.codeNotes,
    costEstimateInr: brief.costEstimateInr,
    warnings: brief.warnings,
  },
  null,
  2
)}
\`\`\`

Write the narrative now, entirely in ${LANGUAGE_NAMES[locale]}.`;

  try {
    // Cache the system prompt — same for every generation. `cache_control` is a beta
    // feature; the SDK accepts it at runtime but the public type doesn't expose it yet,
    // so we cast through any. Behavior at the wire is unchanged.
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } } as any,
      ],
      messages: [{ role: "user", content: userMessage }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return fallback();
    const text = block.text;

    // Cost accounting from actual usage
    const inputTok = (res.usage as any)?.input_tokens || 0;
    const outputTok = (res.usage as any)?.output_tokens || 0;
    // Sonnet 4.5: $3/M input, $15/M output → micro-USD
    const costMicroUsd = inputTok * 3 + outputTok * 15;

    // Cache + usage logging
    await setCachedNarrative(
      req,
      text,
      {
        model: MODEL,
        inputTok,
        outputTok,
      },
      locale
    );
    if (orgId) {
      await logUsage(orgId, "llm_tokens", {
        units: inputTok + outputTok,
        metadata: { model: MODEL, cache: "miss" },
      });
    }

    return { text, cacheHit: false, costMicroUsd };
  } catch (e: any) {
    console.error("[architect] LLM narrative failed:", e?.message || e);
    return fallback();
  }
}
