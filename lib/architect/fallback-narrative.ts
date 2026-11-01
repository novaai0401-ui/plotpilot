import { format, translate, type Locale } from "@/lib/i18n/dict";
import type { Requirements } from "./requirements";
import type { DesignBrief } from "./rules";

/** Plain design brief used when the AI writer is unavailable. Rebuilt in the reader's language. */
export function fallbackNarrative(req: Requirements, brief: DesignBrief, locale: Locale): string {
  const s = (key: string) => translate(`design.narrative.${key}`, locale);
  const overview = format("design.narrative.overview", locale, {
    style: translate(`design.style.${req.preferences.style}`, locale),
    kind: translate(`design.kind.${req.projectType}`, locale),
    builtUp: brief.summary.plannedBuiltUpSqft,
    floors: brief.summary.floors,
    plot: brief.summary.totalSqftPlot,
    far: brief.summary.farUsedPct,
  });
  const layout = format("design.narrative.layout", locale, {
    front: req.plot.setbackFrontFt,
    side: req.plot.setbackSideFt,
  });
  const recommendations = [
    s("windows"),
    req.amenities.solar ? "" : s("solar"),
    req.amenities.rainwater ? "" : s("rainwater"),
  ].filter(Boolean);

  return `## ${s("overviewTitle")}
${overview}

## ${s("layoutTitle")}
${layout}${req.preferences.vastuCompliant ? ` ${s("vastu")}` : ""}

## ${s("recommendationsTitle")}
${recommendations.join(" ")}

## ${s("nextStepsTitle")}
1. ${s("step1")}
2. ${s("step2")}
3. ${s("step3")}`;
}

/** Designs saved before `narrativeFallback` existed carry this developer note instead. */
export function isFallbackNarrative(narrative: string | null, brief: DesignBrief): boolean {
  return !!narrative && (!!brief.narrativeFallback || narrative.includes("ANTHROPIC_API_KEY"));
}
