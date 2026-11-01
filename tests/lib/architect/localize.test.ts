import { describe, it, expect } from "vitest";
import { RequirementsSchema } from "@/lib/architect/requirements";
import { generateBrief } from "@/lib/architect/rules";
import { designForLocale, localizeBrief, localizeText, narrativeForLocale } from "@/lib/architect/localize";
import { fallbackNarrative } from "@/lib/architect/fallback-narrative";
import { buildDesignPdf } from "@/lib/architect/export-pdf";

const TYPES = [
  "residential_house",
  "residential_apartment",
  "commercial_office",
  "commercial_retail",
  "mixed_use",
] as const;

function reqs(projectType: (typeof TYPES)[number], floors = 4, totalSqft = 600) {
  return RequirementsSchema.parse({
    projectType,
    floors,
    unitsPerFloor: 2,
    plot: { totalSqft, frontageFt: 30, depthFt: 20, facing: "NE" },
    rooms: { bedrooms: 3, poojaRooms: 1, studyRooms: 1, servantRooms: 1, utilityRooms: 1 },
    commercial: { workstations: 10, cabins: 2, meetingRooms: 1, retailUnits: 2, reception: true, cafeteria: true },
    amenities: { balcony: true, terrace: true, lift: true, solar: true, rainwater: true },
    preferences: { style: "traditional", vastuCompliant: true, accessibility: true, sustainable: true },
  });
}

/** Acronyms and units that stay in Latin letters in Hindi and Marathi. */
const KEPT_IN_LATIN = /\b(RCC|AAC|UPVC|VOC|RCCB|STP|HVAC|VRF|CCTV|NBC|FAR|kW)\b/g;

function allText(brief: ReturnType<typeof generateBrief>): string[] {
  return [
    ...brief.floors.flatMap((f) => [f.label, ...f.rooms.flatMap((r) => [r.name, r.notes ?? ""])]),
    ...brief.materials,
    ...brief.mep,
    ...brief.codeNotes,
    ...brief.warnings,
  ];
}

describe("localizeBrief", () => {
  for (const type of TYPES) {
    for (const locale of ["hi", "mr"] as const) {
      it(`leaves no English in a ${type} design in ${locale}`, () => {
        const brief = generateBrief(reqs(type));
        expect(brief.warnings.length).toBeGreaterThan(0);
        for (const text of allText(localizeBrief(brief, locale))) {
          expect(text.replace(KEPT_IN_LATIN, "")).not.toMatch(/[A-Za-z]/);
        }
      });
    }
  }

  it("translates room names nested inside a unit", () => {
    expect(localizeText("Unit 2 · Bedroom 1", "mr")).toBe("युनिट 2 · बेडरूम 1");
  });

  it("leaves English and unknown text alone", () => {
    const brief = generateBrief(reqs("residential_house"));
    expect(localizeBrief(brief, "en")).toBe(brief);
    expect(localizeText("Something new", "hi")).toBe("Something new");
  });
});

describe("designForLocale", () => {
  const req = reqs("residential_house");
  const brief = generateBrief(req);

  it("redraws floor plans in the reader's language", () => {
    const { floorPlansSvg } = designForLocale({ requirements: req, brief, narrative: null }, "hi");
    expect(floorPlansSvg[0].label).toBe("भूतल");
    expect(floorPlansSvg[0].svg).toContain("बैठक कक्ष");
    expect(floorPlansSvg[0].svg).not.toContain("sqft");
  });

  it("draws English plans too", () => {
    const { floorPlansSvg } = designForLocale({ requirements: req, brief, narrative: null }, "en");
    expect(floorPlansSvg[0].svg).toContain("Living room");
  });
});

describe("narrativeForLocale", () => {
  const req = reqs("residential_house");
  const brief = generateBrief(req);

  it("replaces older fallbacks and their developer note", () => {
    const old = "## Overview\nText\n\n_AI narrative is currently disabled (no ANTHROPIC_API_KEY set)._";
    const text = narrativeForLocale({ requirements: req, brief, narrative: old }, "en")!;
    expect(text).not.toContain("ANTHROPIC_API_KEY");
    expect(text).toContain("## Overview");
  });

  it("rebuilds a flagged fallback in the reader's language", () => {
    const saved = { requirements: req, brief: { ...brief, narrativeFallback: true }, narrative: "x" };
    expect(narrativeForLocale(saved, "mr")).toContain("## सारांश");
  });

  it("keeps an AI-written brief as written", () => {
    expect(narrativeForLocale({ requirements: req, brief, narrative: "लिखा हुआ" }, "en")).toBe("लिखा हुआ");
  });

  it("fills every placeholder", () => {
    for (const locale of ["en", "hi", "mr"] as const) {
      expect(fallbackNarrative(req, brief, locale)).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("buildDesignPdf", () => {
  for (const locale of ["en", "hi", "mr"] as const) {
    it(`builds a PDF in ${locale} with rupee amounts and warnings`, async () => {
      const req = reqs("mixed_use");
      const brief = generateBrief(req);
      const bytes = await buildDesignPdf({
        requirements: req,
        brief: localizeBrief(brief, locale),
        narrative: fallbackNarrative(req, brief, locale),
        renderImageUrl: null,
        generatedAt: new Date("2026-11-01T10:00:00Z"),
        designId: "abcdefgh1234",
        locale,
      });
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    });
  }
});
