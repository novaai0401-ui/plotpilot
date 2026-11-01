import { format, type Locale } from "@/lib/i18n/dict";
import { DESIGN_OUTPUT } from "@/lib/i18n/strings/design-output";
import { buildableFootprint, type Requirements } from "./requirements";
import { fallbackNarrative, isFallbackNarrative } from "./fallback-narrative";
import { renderAllFloors } from "./floor-plan-svg";
import type { DesignBrief } from "./rules";

/**
 * Saved designs stay in English so DXF exports and AI prompts have one canonical
 * version. The viewer's language is applied here at read time, which also covers
 * designs saved before translation existed.
 */

type Template = { key: string; names: string[]; pattern: RegExp };

const EXACT = new Map<string, string>();
const TEMPLATES: Template[] = [];

for (const [key, { en }] of Object.entries(DESIGN_OUTPUT)) {
  if (!key.startsWith("designOut.")) continue;
  const names = Array.from(en.matchAll(/\{(\w+)\}/g), (m) => m[1]);
  if (names.length === 0) {
    EXACT.set(en, key);
    continue;
  }
  const source = en
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(.+?)");
  TEMPLATES.push({ key, names, pattern: new RegExp(`^${source}$`) });
}

/** Translates one rules-engine string; anything unrecognised comes back unchanged. */
export function localizeText(text: string, locale: Locale): string {
  if (locale === "en") return text;
  const exact = EXACT.get(text);
  if (exact) return format(exact, locale, {});
  for (const { key, names, pattern } of TEMPLATES) {
    const match = pattern.exec(text);
    if (!match) continue;
    const vars = Object.fromEntries(names.map((name, i) => [name, match[i + 1]]));
    // "Unit 2 · Bedroom 1" holds another room name.
    if (vars.name) vars.name = localizeText(vars.name, locale);
    return format(key, locale, vars);
  }
  return text;
}

function floorLabel(label: string, floor: number, locale: Locale): string {
  if (floor < 2) return localizeText(label, locale);
  return format("designOut.floor.n", locale, { n: floor });
}

export function localizeBrief(brief: DesignBrief, locale: Locale): DesignBrief {
  if (locale === "en") return brief;
  const list = (items: string[]) => items.map((item) => localizeText(item, locale));
  return {
    ...brief,
    floors: brief.floors.map((f) => ({
      ...f,
      label: floorLabel(f.label, f.floor, locale),
      rooms: f.rooms.map((r) => ({
        ...r,
        name: localizeText(r.name, locale),
        notes: r.notes && localizeText(r.notes, locale),
      })),
    })),
    materials: list(brief.materials),
    mep: list(brief.mep),
    codeNotes: list(brief.codeNotes),
    warnings: list(brief.warnings),
  };
}

export function narrativeForLocale(
  design: { requirements: Requirements; brief: DesignBrief; narrative: string | null },
  locale: Locale
): string | null {
  return isFallbackNarrative(design.narrative, design.brief)
    ? fallbackNarrative(design.requirements, design.brief, locale)
    : design.narrative;
}

/** Everything the design viewer needs, in the reader's language. */
export function designForLocale(
  design: {
    requirements: Requirements;
    brief: DesignBrief;
    narrative: string | null;
  },
  locale: Locale
) {
  const brief = localizeBrief(design.brief, locale);
  const footprint = buildableFootprint(design.requirements);
  return {
    brief,
    narrative: narrativeForLocale(design, locale),
    floorPlansSvg: renderAllFloors(brief.floors, design.requirements, footprint, locale),
  };
}
