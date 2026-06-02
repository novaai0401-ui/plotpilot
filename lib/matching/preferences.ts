import { z } from "zod";

/**
 * Client preferences — the shape of what a buyer is actually looking for.
 *
 * Lives on `User.preferences` (Json?) for users with role=client. Used by:
 *   - `lib/matching/score.ts` (Match Radar scoring)
 *   - `app/api/plots/[id]/pitch/route.ts` (LLM context for personalized pitch)
 *
 * Wire format is JSON-stable: every field is optional, but the more the buyer
 * fills in, the higher the match precision. The scorer treats `null`/missing
 * fields as "no constraint" — never as a hard rule-out.
 */

const Facing = z.enum(["N", "E", "S", "W", "NE", "NW", "SE", "SW"]);

export const ClientPreferencesSchema = z.object({
  /** Free-text city + locality (e.g. "Bangalore — Whitefield"). */
  location: z.string().trim().max(200).optional(),
  /** Inclusive lower bound on plot size, sqft. */
  sizeSqftMin: z.number().int().positive().max(1_000_000).optional(),
  /** Inclusive upper bound on plot size, sqft. */
  sizeSqftMax: z.number().int().positive().max(1_000_000).optional(),
  /** Inclusive lower bound on price, INR (rupees, not paise). */
  budgetInrMin: z.number().int().nonnegative().max(10_000_000_000).optional(),
  /** Inclusive upper bound on price, INR. */
  budgetInrMax: z.number().int().nonnegative().max(10_000_000_000).optional(),
  /** Preferred facings. Empty array = no preference. */
  facings: z.array(Facing).max(8).default([]).optional(),
  /** Free-text must-haves the matcher pattern-matches against plot description. */
  mustHaves: z.array(z.string().trim().min(1).max(60)).max(20).default([]).optional(),
  /** Broker-only free-text context about this buyer. Passed to the LLM. */
  notes: z.string().trim().max(2_000).optional(),
});

export type ClientPreferences = z.infer<typeof ClientPreferencesSchema>;

/**
 * Coerce an unknown JSON blob into a validated ClientPreferences, or null
 * if the blob is missing / invalid. Never throws — returns null so callers
 * (the matcher, the LLM prompt builder) gracefully degrade.
 */
export function parseClientPreferences(raw: unknown): ClientPreferences | null {
  if (raw == null) return null;
  const result = ClientPreferencesSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Human-readable one-liner for the Match Radar UI. */
export function summarizePreferences(p: ClientPreferences | null): string {
  if (!p) return "No preferences set";
  const parts: string[] = [];
  if (p.location) parts.push(p.location);
  if (p.sizeSqftMin || p.sizeSqftMax) {
    const lo = p.sizeSqftMin ? `${p.sizeSqftMin.toLocaleString("en-IN")}` : "—";
    const hi = p.sizeSqftMax ? `${p.sizeSqftMax.toLocaleString("en-IN")}` : "—";
    parts.push(`${lo}-${hi} sqft`);
  }
  if (p.budgetInrMin || p.budgetInrMax) {
    const lo = p.budgetInrMin ? `₹${(p.budgetInrMin / 100_000).toFixed(1)}L` : "—";
    const hi = p.budgetInrMax ? `₹${(p.budgetInrMax / 100_000).toFixed(1)}L` : "—";
    parts.push(`${lo}-${hi}`);
  }
  if (p.facings && p.facings.length) parts.push(`facing ${p.facings.join("/")}`);
  return parts.join(" · ") || "No constraints";
}
