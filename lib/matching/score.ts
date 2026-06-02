import type { Plot } from "@prisma/client";
import type { ClientPreferences } from "./preferences";

/**
 * Match Radar scorer.
 *
 * Pure function — no IO, no Anthropic calls, deterministic. Given a plot and
 * a list of clients (each with their preferences + name), returns a ranked
 * array with score breakdown so the UI can show *why* each match scored.
 *
 * Design rules:
 *   - Score is 0–100. Sum of weighted sub-scores.
 *   - Missing constraints on the buyer side are TREATED AS NEUTRAL (full
 *     credit). We never punish a buyer for not telling us their budget.
 *   - One hard rule-out: if budget is set AND plot price is set AND the plot
 *     is 2× over the buyer's max, the match drops below the visibility floor.
 *   - The weighting reflects what brokers actually filter by first in India:
 *     location 35, budget 30, size 20, facing 10, must-haves 5.
 *
 * Sort the returned array by `score` desc; the UI shows the top N.
 */

export type MatchInput = {
  clientId: string;
  clientName: string;
  preferences: ClientPreferences | null;
};

export type MatchResult = {
  clientId: string;
  clientName: string;
  score: number; // 0–100, integer
  breakdown: Array<{
    dimension: "location" | "budget" | "size" | "facing" | "must-haves";
    weight: number;
    points: number; // out of weight
    note: string;
  }>;
  /** True if the strict budget rule-out fired. UI typically hides these. */
  ruledOut: boolean;
};

const WEIGHTS = {
  location: 35,
  budget: 30,
  size: 20,
  facing: 10,
  mustHaves: 5,
} as const;

/** Lower-case normalized location key for fuzzy substring match. */
function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreMatches(plot: Plot, inputs: MatchInput[]): MatchResult[] {
  const plotLoc = norm(plot.location) + " " + norm(plot.city);
  const plotPrice = plot.priceInr ?? null;
  const plotSize = plot.sizeSqft ?? null;
  const plotDesc = norm(plot.description);

  return inputs
    .map((input) => scoreOne(input, { plotLoc, plotPrice, plotSize, plotDesc }))
    .sort((a, b) => b.score - a.score);
}

function scoreOne(
  input: MatchInput,
  ctx: {
    plotLoc: string;
    plotPrice: number | null;
    plotSize: number | null;
    plotDesc: string;
  }
): MatchResult {
  const p = input.preferences;
  const breakdown: MatchResult["breakdown"] = [];

  // ── Location ────────────────────────────────────────────────────────────
  let locPts: number = WEIGHTS.location;
  let locNote = "No location preference — full credit";
  if (p?.location) {
    const want = norm(p.location);
    // Split on spaces, count token overlap. A single matching token (e.g.
    // "Bangalore") gives partial credit; multi-token overlap (e.g.
    // "Bangalore Whitefield") gives full credit.
    const wantTokens = want.split(" ").filter((t) => t.length >= 3);
    const overlap = wantTokens.filter((t) => ctx.plotLoc.includes(t)).length;
    if (wantTokens.length === 0) {
      locNote = "Empty location — full credit";
    } else if (overlap === 0) {
      locPts = 0;
      locNote = `Wants ${p.location} — plot doesn't match`;
    } else if (overlap < wantTokens.length) {
      locPts = Math.round((overlap / wantTokens.length) * WEIGHTS.location);
      locNote = `Partial location match (${overlap}/${wantTokens.length} tokens)`;
    } else {
      locNote = `Location matches: ${p.location}`;
    }
  }
  breakdown.push({ dimension: "location", weight: WEIGHTS.location, points: locPts, note: locNote });

  // ── Budget ──────────────────────────────────────────────────────────────
  let budgetPts: number = WEIGHTS.budget;
  let budgetNote = "No budget set — full credit";
  let ruledOut = false;
  if (p && ctx.plotPrice != null && (p.budgetInrMin != null || p.budgetInrMax != null)) {
    const lo = p.budgetInrMin ?? 0;
    const hi = p.budgetInrMax ?? Number.POSITIVE_INFINITY;
    if (ctx.plotPrice >= lo && ctx.plotPrice <= hi) {
      budgetNote = `Within budget (₹${(ctx.plotPrice / 100_000).toFixed(1)}L)`;
    } else if (ctx.plotPrice < lo) {
      // Cheaper than min budget — slightly suspicious but not punished
      const gap = (lo - ctx.plotPrice) / lo;
      budgetPts = Math.round(WEIGHTS.budget * (1 - Math.min(gap, 0.4)));
      budgetNote = `Below buyer's floor (₹${(lo / 100_000).toFixed(1)}L)`;
    } else {
      // Over budget. Score degrades smoothly; hard-rule-out at 2x.
      const overshoot = (ctx.plotPrice - hi) / hi;
      if (overshoot >= 1.0) {
        ruledOut = true;
        budgetPts = 0;
        budgetNote = `Over 2× budget — ruled out`;
      } else {
        budgetPts = Math.round(WEIGHTS.budget * (1 - overshoot));
        budgetNote = `${Math.round(overshoot * 100)}% over budget`;
      }
    }
  }
  breakdown.push({ dimension: "budget", weight: WEIGHTS.budget, points: budgetPts, note: budgetNote });

  // ── Size ────────────────────────────────────────────────────────────────
  let sizePts: number = WEIGHTS.size;
  let sizeNote = "No size constraint — full credit";
  if (p && ctx.plotSize != null && (p.sizeSqftMin != null || p.sizeSqftMax != null)) {
    const lo = p.sizeSqftMin ?? 0;
    const hi = p.sizeSqftMax ?? Number.POSITIVE_INFINITY;
    if (ctx.plotSize >= lo && ctx.plotSize <= hi) {
      sizeNote = `Within size range (${ctx.plotSize.toLocaleString("en-IN")} sqft)`;
    } else if (ctx.plotSize < lo) {
      const gap = (lo - ctx.plotSize) / lo;
      sizePts = Math.round(WEIGHTS.size * (1 - Math.min(gap, 0.6)));
      sizeNote = `${Math.round(gap * 100)}% smaller than wanted`;
    } else {
      const gap = (ctx.plotSize - hi) / hi;
      sizePts = Math.round(WEIGHTS.size * (1 - Math.min(gap, 0.5)));
      sizeNote = `${Math.round(gap * 100)}% larger than wanted`;
    }
  }
  breakdown.push({ dimension: "size", weight: WEIGHTS.size, points: sizePts, note: sizeNote });

  // ── Facing ──────────────────────────────────────────────────────────────
  // The Plot schema doesn't have a `facing` field today — we infer from
  // description text. If facings preferences are set AND the description
  // mentions one of them, full credit; otherwise neutral (no signal).
  let facingPts: number = WEIGHTS.facing;
  let facingNote = "No facing set — full credit";
  if (p?.facings && p.facings.length > 0) {
    const found = p.facings.find((f) =>
      // Look for `e-facing`, `east facing`, `east-facing`, etc. in description.
      ctx.plotDesc.includes(f.toLowerCase() + " facing") ||
      ctx.plotDesc.includes(facingWord(f) + " facing") ||
      ctx.plotDesc.includes(facingWord(f) + "-facing")
    );
    if (found) {
      facingNote = `${facingWord(found).replace(/^./, (c) => c.toUpperCase())}-facing match`;
    } else {
      // Neutral — plot's facing simply isn't documented; we don't penalize.
      facingPts = Math.round(WEIGHTS.facing * 0.5);
      facingNote = `Wants ${p.facings.join("/")} — plot facing not stated`;
    }
  }
  breakdown.push({ dimension: "facing", weight: WEIGHTS.facing, points: facingPts, note: facingNote });

  // ── Must-haves ──────────────────────────────────────────────────────────
  let mustPts: number = WEIGHTS.mustHaves;
  let mustNote = "No must-haves — full credit";
  if (p?.mustHaves && p.mustHaves.length > 0) {
    const matched = p.mustHaves.filter((m) => ctx.plotDesc.includes(norm(m)));
    mustPts = Math.round((matched.length / p.mustHaves.length) * WEIGHTS.mustHaves);
    mustNote =
      matched.length === 0
        ? `0/${p.mustHaves.length} must-haves found`
        : `${matched.length}/${p.mustHaves.length} must-haves: ${matched.join(", ")}`;
  }
  breakdown.push({ dimension: "must-haves", weight: WEIGHTS.mustHaves, points: mustPts, note: mustNote });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  return {
    clientId: input.clientId,
    clientName: input.clientName,
    score: Math.max(0, Math.min(100, score)),
    breakdown,
    ruledOut,
  };
}

function facingWord(f: ClientPreferences["facings"] extends Array<infer T> | undefined ? T : never): string {
  switch (f) {
    case "N":
      return "north";
    case "E":
      return "east";
    case "S":
      return "south";
    case "W":
      return "west";
    case "NE":
      return "north-east";
    case "NW":
      return "north-west";
    case "SE":
      return "south-east";
    case "SW":
      return "south-west";
    default:
      return String(f).toLowerCase();
  }
}
