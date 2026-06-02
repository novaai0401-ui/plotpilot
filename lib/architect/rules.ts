import {
  Requirements,
  buildableFootprint,
  maxBuiltUpSqft,
} from "./requirements";

/**
 * Rules engine: turns validated Requirements into a deterministic Design Brief
 * (room list per floor with dimensions, totals, materials/MEP suggestions).
 *
 * Conservative — sizes come from common Indian/global residential standards.
 * No AI here — pure math and lookup tables, so the same input always produces the same brief.
 */

export type RoomSpec = {
  name: string;
  type: RoomType;
  widthFt: number;
  depthFt: number;
  areaSqft: number;
  /** Estimated construction cost in INR (rounded). Populated by computeRoomCosts(). */
  costInr?: number;
  /** INR per sqft used for this room (varies by type). */
  costPerSqftInr?: number;
  notes?: string;
};

export type RoomType =
  | "bedroom"
  | "master_bedroom"
  | "bathroom"
  | "kitchen"
  | "living"
  | "dining"
  | "study"
  | "pooja"
  | "utility"
  | "servant"
  | "balcony"
  | "lobby"
  | "stairs"
  | "lift"
  | "reception"
  | "workstation_area"
  | "cabin"
  | "meeting_room"
  | "cafeteria"
  | "retail_unit"
  | "parking"
  | "terrace"
  | "garden";

export type FloorPlan = {
  floor: number;          // 0 = ground, 1 = first, ... -1 = basement
  label: string;          // "Ground floor", "First floor", "Basement"
  rooms: RoomSpec[];
  netSqft: number;        // sum of room areas
  /** Sum of per-room cost estimates on this floor (INR). Populated by computeRoomCosts(). */
  floorCostInr?: number;
};

export type DesignBrief = {
  projectType: Requirements["projectType"];
  summary: {
    totalSqftPlot: number;
    maxBuiltUpSqft: number;
    plannedBuiltUpSqft: number;
    footprintWidthFt: number;
    footprintDepthFt: number;
    floors: number;
    unitsPerFloor: number;
    farUsedPct: number;
  };
  floors: FloorPlan[];
  materials: string[];
  mep: string[];           // mechanical/electrical/plumbing recommendations
  codeNotes: string[];
  costEstimateInr?: { low: number; high: number; perSqftInr: number };
  warnings: string[];
};

// Standard room dimensions (in feet) — { min, ideal }
const ROOM_LIBRARY: Record<
  Exclude<RoomType, "stairs" | "lift" | "lobby" | "balcony" | "parking" | "terrace" | "garden">,
  { w: number; d: number }
> = {
  bedroom: { w: 11, d: 12 },
  master_bedroom: { w: 13, d: 15 },
  bathroom: { w: 6, d: 8 },
  kitchen: { w: 9, d: 11 },
  living: { w: 14, d: 18 },
  dining: { w: 10, d: 12 },
  study: { w: 9, d: 10 },
  pooja: { w: 5, d: 6 },
  utility: { w: 6, d: 8 },
  servant: { w: 7, d: 9 },
  reception: { w: 12, d: 14 },
  workstation_area: { w: 20, d: 25 }, // grows with count
  cabin: { w: 10, d: 12 },
  meeting_room: { w: 12, d: 15 },
  cafeteria: { w: 15, d: 20 },
  retail_unit: { w: 15, d: 20 },
};

function makeRoom(type: RoomType, name: string, w: number, d: number, notes?: string): RoomSpec {
  return { name, type, widthFt: w, depthFt: d, areaSqft: Math.round(w * d), notes };
}

function residentialRoomsForFloor(
  r: Requirements,
  floor: number,
  isTopFloor: boolean
): RoomSpec[] {
  const rooms: RoomSpec[] = [];
  const lib = ROOM_LIBRARY;
  const isGround = floor === 0;

  if (isGround) {
    // Ground typically houses common areas
    if (r.rooms.livingRooms > 0)
      rooms.push(makeRoom("living", "Living room", lib.living.w, lib.living.d));
    if (r.rooms.diningRooms > 0)
      rooms.push(makeRoom("dining", "Dining", lib.dining.w, lib.dining.d));
    if (r.rooms.kitchens > 0)
      rooms.push(
        makeRoom("kitchen", "Kitchen", lib.kitchen.w, lib.kitchen.d, "Place east/north-east if vastu")
      );
    if (r.rooms.poojaRooms > 0)
      rooms.push(makeRoom("pooja", "Pooja room", lib.pooja.w, lib.pooja.d));
    if (r.rooms.utilityRooms > 0)
      rooms.push(makeRoom("utility", "Utility", lib.utility.w, lib.utility.d));
    rooms.push(makeRoom("bathroom", "Powder room", lib.bathroom.w, lib.bathroom.d));
  }

  // Distribute bedrooms across non-ground floors (or all on ground for single-floor)
  const totalBedrooms = r.rooms.bedrooms;
  const bedroomFloors = Math.max(1, r.floors - (r.floors > 1 ? 1 : 0));
  const bedroomsThisFloor = isGround && r.floors > 1
    ? 0
    : Math.ceil(totalBedrooms / bedroomFloors);

  for (let i = 0; i < bedroomsThisFloor; i++) {
    const isMaster = floor === r.floors - 1 && i === 0; // master on top floor first
    const lib2 = isMaster ? lib.master_bedroom : lib.bedroom;
    rooms.push(makeRoom(isMaster ? "master_bedroom" : "bedroom", isMaster ? "Master bedroom" : `Bedroom ${i + 1}`, lib2.w, lib2.d));
    rooms.push(makeRoom("bathroom", isMaster ? "Master bath" : `Bath ${i + 1}`, lib.bathroom.w, lib.bathroom.d));
  }

  if (isGround && r.rooms.studyRooms > 0) {
    rooms.push(makeRoom("study", "Study", lib.study.w, lib.study.d));
  }
  if (r.rooms.servantRooms > 0 && isGround) {
    rooms.push(makeRoom("servant", "Servant room", lib.servant.w, lib.servant.d));
  }

  // Verticals on every floor
  if (r.floors > 1) {
    rooms.push(makeRoom("stairs", "Staircase", 8, 12));
    if (r.amenities.lift) rooms.push(makeRoom("lift", "Lift", 6, 6));
  }
  if (r.amenities.balcony) {
    rooms.push(makeRoom("balcony", "Balcony", 5, 10));
  }
  if (isTopFloor && r.amenities.terrace) {
    rooms.push(makeRoom("terrace", "Terrace access", 8, 8));
  }

  return rooms;
}

function commercialRoomsForFloor(
  r: Requirements,
  floor: number,
  isTopFloor: boolean
): RoomSpec[] {
  const rooms: RoomSpec[] = [];
  const lib = ROOM_LIBRARY;
  const isGround = floor === 0;
  const wsPerFloor = Math.ceil(r.commercial.workstations / r.floors);
  const cabinsPerFloor = Math.ceil(r.commercial.cabins / r.floors);
  const meetingsPerFloor = Math.ceil(r.commercial.meetingRooms / r.floors);

  if (isGround && r.commercial.reception) {
    rooms.push(makeRoom("reception", "Reception & lobby", lib.reception.w, lib.reception.d));
  }
  if (wsPerFloor > 0) {
    // Scale workstation area: ~50 sqft per workstation
    const totalArea = wsPerFloor * 50;
    const w = Math.ceil(Math.sqrt(totalArea * 1.2));
    const d = Math.ceil(totalArea / w);
    rooms.push(makeRoom("workstation_area", `Workstation area (${wsPerFloor} seats)`, w, d));
  }
  for (let i = 0; i < cabinsPerFloor; i++) {
    rooms.push(makeRoom("cabin", `Cabin ${floor + 1}-${i + 1}`, lib.cabin.w, lib.cabin.d));
  }
  for (let i = 0; i < meetingsPerFloor; i++) {
    rooms.push(makeRoom("meeting_room", `Meeting ${floor + 1}-${i + 1}`, lib.meeting_room.w, lib.meeting_room.d));
  }
  if (r.commercial.cafeteria && isTopFloor) {
    rooms.push(makeRoom("cafeteria", "Cafeteria", lib.cafeteria.w, lib.cafeteria.d));
  }

  // Restrooms (M/F)
  rooms.push(makeRoom("bathroom", "Men's restroom", 8, 10));
  rooms.push(makeRoom("bathroom", "Women's restroom", 8, 10));

  // Verticals
  rooms.push(makeRoom("stairs", "Staircase", 10, 14));
  if (r.floors > 2 || r.amenities.lift) rooms.push(makeRoom("lift", "Lift", 7, 7));

  // Ground-floor retail for mixed-use or retail commercial
  if (isGround && r.commercial.retailUnits > 0) {
    for (let i = 0; i < r.commercial.retailUnits; i++) {
      rooms.push(makeRoom("retail_unit", `Retail unit ${i + 1}`, lib.retail_unit.w, lib.retail_unit.d));
    }
  }

  return rooms;
}

export function generateBrief(r: Requirements): DesignBrief {
  const footprint = buildableFootprint(r);
  const maxBuiltUp = maxBuiltUpSqft(r);
  const warnings: string[] = [];

  const floors: FloorPlan[] = [];
  for (let f = 0; f < r.floors; f++) {
    const isTop = f === r.floors - 1;
    let rooms: RoomSpec[];
    if (r.projectType === "residential_house" || r.projectType === "residential_apartment") {
      rooms = residentialRoomsForFloor(r, f, isTop);
      // Apartment: duplicate per unit
      if (r.projectType === "residential_apartment" && r.unitsPerFloor > 1) {
        const baseRooms = [...rooms];
        rooms = [];
        for (let u = 0; u < r.unitsPerFloor; u++) {
          baseRooms.forEach((br) =>
            rooms.push({ ...br, name: `Unit ${u + 1} · ${br.name}` })
          );
        }
        // shared
        rooms.push(makeRoom("lobby", "Common lobby", 10, 10));
      }
    } else if (r.projectType === "commercial_office" || r.projectType === "commercial_retail") {
      rooms = commercialRoomsForFloor(r, f, isTop);
    } else {
      // mixed_use: retail on ground, residential above
      rooms = f === 0
        ? commercialRoomsForFloor(r, 0, false)
        : residentialRoomsForFloor(r, f, isTop);
    }

    const netSqft = rooms.reduce((s, x) => s + x.areaSqft, 0);
    if (netSqft > footprint.widthFt * footprint.depthFt) {
      warnings.push(
        `Floor ${f} net area (${netSqft} sqft) exceeds usable footprint (${Math.round(
          footprint.widthFt * footprint.depthFt
        )} sqft). Consider reducing room count or increasing floors.`
      );
    }
    floors.push({
      floor: f,
      label: f === 0 ? "Ground floor" : f === 1 ? "First floor" : `${ordinal(f)} floor`,
      rooms,
      netSqft,
    });
  }

  const plannedBuiltUp = floors.reduce((s, f) => s + f.netSqft, 0);
  if (plannedBuiltUp > maxBuiltUp) {
    warnings.push(
      `Planned built-up (${plannedBuiltUp} sqft) exceeds FAR cap (${maxBuiltUp} sqft). Reduce rooms or request FAR variance.`
    );
  }

  // Cost estimate: rough INR per sqft (base rate by project type)
  const perSqftByType: Record<Requirements["projectType"], number> = {
    residential_house: 2200,
    residential_apartment: 1900,
    commercial_office: 2800,
    commercial_retail: 2500,
    mixed_use: 2400,
  };
  const baseRate = perSqftByType[r.projectType];

  // Per-room cost = baseRate × room area × roomMultiplier (kitchens/baths cost more
  // due to plumbing/electrical; parking/balcony cost less; etc.)
  computeRoomCosts(floors, baseRate);
  const summedRoomCosts = floors.reduce((s, f) => s + (f.floorCostInr || 0), 0);
  const costEstimateInr = {
    perSqftInr: baseRate,
    // Take the higher of (rule-of-thumb planned × baseRate) and (sum of per-room costs) as the midpoint
    low: Math.round(Math.max(plannedBuiltUp * baseRate, summedRoomCosts) * 0.9),
    high: Math.round(Math.max(plannedBuiltUp * baseRate, summedRoomCosts) * 1.3),
  };

  const materials = pickMaterials(r);
  const mep = pickMep(r);
  const codeNotes = codeNotesFor(r);

  return {
    projectType: r.projectType,
    summary: {
      totalSqftPlot: r.plot.totalSqft,
      maxBuiltUpSqft: maxBuiltUp,
      plannedBuiltUpSqft: plannedBuiltUp,
      footprintWidthFt: Math.round(footprint.widthFt),
      footprintDepthFt: Math.round(footprint.depthFt),
      floors: r.floors,
      unitsPerFloor: r.unitsPerFloor,
      farUsedPct: Math.round((plannedBuiltUp / r.plot.totalSqft) * 100),
    },
    floors,
    materials,
    mep,
    codeNotes,
    costEstimateInr,
    warnings,
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Cost multiplier per room type. Kitchens and bathrooms cost most per sqft
 * (plumbing, tile, fixtures); circulation and parking cost least.
 * Source: industry rules of thumb — these are approximate, vary by region.
 */
const ROOM_COST_MULTIPLIER: Partial<Record<RoomType, number>> = {
  kitchen: 1.8,
  bathroom: 2.0,
  master_bedroom: 1.15,
  bedroom: 1.05,
  living: 1.10,
  dining: 1.0,
  study: 1.0,
  pooja: 0.95,
  utility: 0.85,
  servant: 0.85,
  balcony: 0.55,
  terrace: 0.45,
  garden: 0.25,
  stairs: 0.9,
  lift: 2.2, // shaft + mechanical
  lobby: 0.85,
  reception: 1.2,
  cabin: 1.1,
  meeting_room: 1.25, // AV + acoustic
  workstation_area: 1.0,
  cafeteria: 1.4, // kitchen + plumbing
  retail_unit: 1.1,
  parking: 0.4,
};

function computeRoomCosts(floors: FloorPlan[], baseRate: number) {
  for (const f of floors) {
    let total = 0;
    for (const r of f.rooms) {
      const mult = ROOM_COST_MULTIPLIER[r.type] ?? 1.0;
      const perSqft = Math.round(baseRate * mult);
      const cost = Math.round(r.areaSqft * perSqft);
      r.costInr = cost;
      r.costPerSqftInr = perSqft;
      total += cost;
    }
    f.floorCostInr = total;
  }
}

function pickMaterials(r: Requirements): string[] {
  const m: string[] = ["RCC frame structure", "AAC block walls (lightweight, thermal)"];
  if (r.preferences.style === "modern" || r.preferences.style === "minimalist") {
    m.push("Vitrified floor tiles", "Aluminium-glass facade for windows");
  } else if (r.preferences.style === "traditional") {
    m.push("Kota / granite flooring", "Teak wood doors", "Lime plaster finish");
  } else {
    m.push("Vitrified floor tiles", "UPVC windows");
  }
  if (r.preferences.sustainable) m.push("Fly-ash bricks", "Low-VOC paints", "Recycled steel");
  return m;
}

function pickMep(r: Requirements): string[] {
  const mep: string[] = ["3-phase electrical supply", "Modular wiring with RCCB"];
  if (r.amenities.lift) mep.push("Passenger lift (6-8 person capacity)");
  if (r.amenities.solar) mep.push("Rooftop solar PV (3-5 kW)");
  if (r.amenities.rainwater) mep.push("Rainwater harvesting (recharge pit + storage tank)");
  mep.push("STP / soak pit for waste water");
  mep.push("Centralized water tank (overhead + underground)");
  if (r.projectType.startsWith("commercial")) {
    mep.push("Central HVAC (VRF system)", "Fire alarm + sprinkler", "CCTV + access control");
  }
  return mep;
}

function codeNotesFor(r: Requirements): string[] {
  const notes: string[] = [];
  notes.push(
    `Setbacks: front ${r.plot.setbackFrontFt}ft, rear ${r.plot.setbackRearFt}ft, sides ${r.plot.setbackSideFt}ft.`
  );
  notes.push(`FAR cap ${r.plot.maxFAR}× plot area = ${maxBuiltUpSqft(r)} sqft max built-up.`);
  notes.push(`Max height ${r.plot.maxHeightFt}ft per local bylaws.`);
  if (r.preferences.accessibility)
    notes.push("Accessibility: ramps ≤1:12 slope, 36in doorways, accessible WC on ground floor.");
  if (r.preferences.vastuCompliant)
    notes.push("Vastu: main door N/E, kitchen SE, master bedroom SW, pooja NE.");
  if (r.projectType.startsWith("commercial"))
    notes.push("NBC fire safety: 2 staircases if >15m height; refuge area every 7 floors.");
  return notes;
}
