import { z } from "zod";

/**
 * Validated input shape for a building design request.
 * Comprehensive enough to drive the rules engine, the LLM prompt, and the image prompt.
 */

export const ProjectType = z.enum([
  "residential_house",      // standalone house / villa
  "residential_apartment",  // multi-unit residential building
  "commercial_office",      // office building
  "commercial_retail",      // shop / showroom / retail floor
  "mixed_use",              // residential + commercial mix
]);
export type ProjectType = z.infer<typeof ProjectType>;

export const Orientation = z.enum(["N", "E", "S", "W", "NE", "NW", "SE", "SW"]);
export const StylePreference = z.enum([
  "modern",
  "contemporary",
  "traditional",
  "minimalist",
  "industrial",
  "mediterranean",
  "colonial",
]);

export const RequirementsSchema = z.object({
  projectType: ProjectType,

  // Plot dimensions
  plot: z.object({
    totalSqft: z.number().min(200).max(500_000),
    frontageFt: z.number().min(10).max(2000).optional(),
    depthFt: z.number().min(10).max(2000).optional(),
    facing: Orientation.optional(),
    // Local rules
    setbackFrontFt: z.number().min(0).max(50).default(5),
    setbackRearFt: z.number().min(0).max(50).default(3),
    setbackSideFt: z.number().min(0).max(50).default(3),
    maxFAR: z.number().min(0.5).max(10).default(2.0), // Floor Area Ratio cap
    maxHeightFt: z.number().min(10).max(500).default(45),
  }),

  // Floors / units
  floors: z.number().int().min(1).max(50).default(2),
  unitsPerFloor: z.number().int().min(1).max(50).default(1), // for apartments

  // Residential rooms (per unit, ignored for commercial)
  rooms: z
    .object({
      bedrooms: z.number().int().min(0).max(10).default(3),
      bathrooms: z.number().int().min(0).max(10).default(2),
      kitchens: z.number().int().min(0).max(3).default(1),
      livingRooms: z.number().int().min(0).max(3).default(1),
      diningRooms: z.number().int().min(0).max(2).default(1),
      studyRooms: z.number().int().min(0).max(3).default(0),
      poojaRooms: z.number().int().min(0).max(2).default(0),
      utilityRooms: z.number().int().min(0).max(3).default(1),
      servantRooms: z.number().int().min(0).max(2).default(0),
    })
    .default({}),

  // Commercial requirements
  commercial: z
    .object({
      workstations: z.number().int().min(0).max(2000).default(0),
      cabins: z.number().int().min(0).max(50).default(0),
      meetingRooms: z.number().int().min(0).max(20).default(0),
      reception: z.boolean().default(true),
      cafeteria: z.boolean().default(false),
      retailUnits: z.number().int().min(0).max(50).default(0),
    })
    .default({}),

  parking: z
    .object({
      cars: z.number().int().min(0).max(500).default(2),
      bikes: z.number().int().min(0).max(500).default(2),
      basement: z.boolean().default(false),
    })
    .default({}),

  amenities: z
    .object({
      balcony: z.boolean().default(true),
      terrace: z.boolean().default(true),
      garden: z.boolean().default(false),
      pool: z.boolean().default(false),
      gym: z.boolean().default(false),
      lift: z.boolean().default(false),
      solar: z.boolean().default(false),
      rainwater: z.boolean().default(false),
    })
    .default({}),

  preferences: z
    .object({
      style: StylePreference.default("modern"),
      vastuCompliant: z.boolean().default(false),
      accessibility: z.boolean().default(false), // wheelchair-friendly
      sustainable: z.boolean().default(false),
      climate: z
        .enum(["tropical", "temperate", "arid", "cold", "humid"])
        .default("tropical"),
    })
    .default({}),

  budget: z
    .object({
      minInr: z.number().int().min(0).optional(),
      maxInr: z.number().int().min(0).optional(),
    })
    .default({}),

  notes: z.string().max(2000).optional(),
});

export type Requirements = z.infer<typeof RequirementsSchema>;

/**
 * Compute plot footprint after setbacks. Returns { widthFt, depthFt } usable for building base.
 */
export function buildableFootprint(r: Requirements): { widthFt: number; depthFt: number } {
  const p = r.plot;
  // If frontage/depth not provided, assume square
  const w = p.frontageFt ?? Math.sqrt(p.totalSqft);
  const d = p.depthFt ?? p.totalSqft / w;
  return {
    widthFt: Math.max(10, w - p.setbackSideFt * 2),
    depthFt: Math.max(10, d - p.setbackFrontFt - p.setbackRearFt),
  };
}

/**
 * Max allowed built-up area = totalSqft × FAR.
 */
export function maxBuiltUpSqft(r: Requirements): number {
  return Math.floor(r.plot.totalSqft * r.plot.maxFAR);
}
