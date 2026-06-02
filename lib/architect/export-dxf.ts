import type { DesignBrief } from "./rules";
import type { Requirements } from "./requirements";
import { buildableFootprint } from "./requirements";

/**
 * Generate an AutoCAD-compatible DXF (R12 / AC1009 minimal flavor) of the floor plans.
 *
 * Each floor becomes its own LAYER ("FLOOR_0", "FLOOR_1", ...) so the architect can
 * toggle floors independently in AutoCAD / LibreCAD / QCAD / DraftSight.
 *
 * Per floor:
 *  - Plot footprint as a dashed LWPOLYLINE
 *  - Each room as a closed LWPOLYLINE rectangle
 *  - Room name + dimensions as TEXT entities at room center
 *
 * Units: feet (DXF $INSUNITS = 2). Multiply scene coordinates by 1 for human scale.
 *
 * Reference: https://www.autodesk.com/techpubs/autocad/acad2000/dxf/
 */

type Placed = { x: number; y: number; w: number; d: number; name: string; type: string; area: number };

const COLOR_BY_TYPE: Record<string, number> = {
  // AutoCAD Color Index (ACI)
  master_bedroom: 41,
  bedroom: 42,
  bathroom: 5,
  kitchen: 30,
  living: 3,
  dining: 3,
  balcony: 92,
  terrace: 92,
  stairs: 8,
  lift: 8,
  lobby: 8,
  reception: 6,
  cabin: 6,
  meeting_room: 6,
  workstation_area: 6,
  cafeteria: 6,
  retail_unit: 200,
  study: 51,
  pooja: 51,
  utility: 9,
};

function packRooms(floor: DesignBrief["floors"][number], maxWidthFt: number): Placed[] {
  const sorted = [...floor.rooms].sort((a, b) => b.areaSqft - a.areaSqft);
  const placed: Placed[] = [];
  let cursorX = 0,
    cursorY = 0,
    rowHeight = 0;
  for (const r of sorted) {
    if (cursorX + r.widthFt > maxWidthFt && cursorX > 0) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    placed.push({
      x: cursorX,
      y: -cursorY, // DXF y grows up; we want floor-plan top-down so negate
      w: r.widthFt,
      d: r.depthFt,
      name: r.name,
      type: r.type,
      area: r.areaSqft,
    });
    cursorX += r.widthFt;
    rowHeight = Math.max(rowHeight, r.depthFt);
  }
  return placed;
}

export function buildDxf(req: Requirements, brief: DesignBrief): string {
  const fp = buildableFootprint(req);
  const lines: string[] = [];

  // --- HEADER ---
  lines.push("0", "SECTION", "2", "HEADER");
  lines.push("9", "$ACADVER", "1", "AC1009");
  lines.push("9", "$INSUNITS", "70", "2"); // feet
  lines.push("0", "ENDSEC");

  // --- TABLES: define one LAYER per floor ---
  lines.push("0", "SECTION", "2", "TABLES");
  lines.push("0", "TABLE", "2", "LAYER", "70", String(brief.floors.length + 2));

  // Default layers
  lines.push("0", "LAYER", "2", "FOOTPRINT", "70", "0", "62", "8", "6", "DASHED");
  lines.push("0", "LAYER", "2", "TEXT", "70", "0", "62", "7", "6", "CONTINUOUS");
  for (const f of brief.floors) {
    lines.push("0", "LAYER", "2", `FLOOR_${f.floor}`, "70", "0", "62", "256", "6", "CONTINUOUS");
  }
  lines.push("0", "ENDTAB", "0", "ENDSEC");

  // --- ENTITIES ---
  lines.push("0", "SECTION", "2", "ENTITIES");

  // Each floor: offset along X so floors lay out side-by-side in CAD viewport
  // (so you can see them all at once; layer toggle still lets you view one)
  const PAGE_GAP = 20; // feet between floor layouts
  let pageOffsetX = 0;

  for (const floor of brief.floors) {
    const placed = packRooms(floor, fp.widthFt);

    // Footprint rectangle on FOOTPRINT layer
    drawPolyline(
      lines,
      "FOOTPRINT",
      [
        [pageOffsetX, 0],
        [pageOffsetX + fp.widthFt, 0],
        [pageOffsetX + fp.widthFt, -fp.depthFt],
        [pageOffsetX, -fp.depthFt],
      ],
      true,
      8
    );

    // Floor label (above the footprint)
    drawText(lines, `TEXT`, pageOffsetX, 4, 1.5, `${floor.label} (${floor.netSqft} sqft)`, 1);

    // Rooms
    for (const r of placed) {
      const x = pageOffsetX + r.x;
      const y = r.y; // already negated
      drawPolyline(
        lines,
        `FLOOR_${floor.floor}`,
        [
          [x, y],
          [x + r.w, y],
          [x + r.w, y - r.d],
          [x, y - r.d],
        ],
        true,
        COLOR_BY_TYPE[r.type] ?? 7
      );
      // Label at center
      const cx = x + r.w / 2;
      const cy = y - r.d / 2;
      const labelSize = Math.max(0.6, Math.min(1.2, r.w / 10));
      drawText(lines, "TEXT", cx - r.w / 4, cy + labelSize, labelSize, r.name, 7);
      drawText(
        lines,
        "TEXT",
        cx - r.w / 4,
        cy - labelSize,
        labelSize * 0.8,
        `${r.w}' x ${r.d}' = ${r.area} sf`,
        8
      );
    }

    pageOffsetX += fp.widthFt + PAGE_GAP;
  }

  lines.push("0", "ENDSEC");
  lines.push("0", "EOF");

  return lines.join("\n");
}

function drawPolyline(
  out: string[],
  layer: string,
  points: [number, number][],
  closed: boolean,
  color: number
) {
  out.push("0", "LWPOLYLINE", "8", layer, "62", String(color));
  out.push("90", String(points.length));
  out.push("70", closed ? "1" : "0");
  for (const [x, y] of points) {
    out.push("10", x.toFixed(3), "20", y.toFixed(3));
  }
}

function drawText(
  out: string[],
  layer: string,
  x: number,
  y: number,
  height: number,
  value: string,
  color: number
) {
  out.push("0", "TEXT", "8", layer, "62", String(color));
  out.push("10", x.toFixed(3), "20", y.toFixed(3), "30", "0");
  out.push("40", height.toFixed(3));
  // Strip non-ASCII (DXF R12 is ASCII-only); replace with closest equivalent
  out.push("1", value.replace(/[^\x20-\x7E]/g, "?"));
}
