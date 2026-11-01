import { format, translate, type Locale } from "@/lib/i18n/dict";
import type { FloorPlan, RoomSpec } from "./rules";
import type { Requirements } from "./requirements";

/**
 * Greedy row-packing layout: places rooms inside a rectangular footprint, left-to-right,
 * wrapping to a new row when the row is full. Not a real architect, but produces a
 * readable schematic that conveys size relationships, adjacency, and total footprint.
 *
 * Output: one SVG per floor, with labels and dimensions.
 */

export type FloorPlanSvg = {
  floor: number;
  label: string;
  svg: string;
};

/** Optional replacement for <text>, used by the PDF because resvg garbles Devanagari. */
export type SvgTextDrawer = (
  text: string,
  x: number,
  y: number,
  style: { size: number; bold?: boolean; fill: string; anchor?: "start" | "middle" | "end" }
) => string;

const svgText: SvgTextDrawer = (text, x, y, { size, bold, fill, anchor = "start" }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-family="sans-serif" fill="${fill}"${
    bold ? ' font-weight="600"' : ""
  }>${escapeXml(text)}</text>`;

const SCALE = 12; // pixels per foot
const PADDING = 24;
const LABEL_H = 44;

function placeRooms(rooms: RoomSpec[], maxWidthFt: number): { x: number; y: number; r: RoomSpec }[] {
  // Sort large rooms first so big anchors go in first.
  const sorted = [...rooms].sort((a, b) => b.areaSqft - a.areaSqft);
  const placed: { x: number; y: number; r: RoomSpec }[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const room of sorted) {
    // If this room doesn't fit in the current row, wrap.
    if (cursorX + room.widthFt > maxWidthFt && cursorX > 0) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    placed.push({ x: cursorX, y: cursorY, r: room });
    cursorX += room.widthFt;
    rowHeight = Math.max(rowHeight, room.depthFt);
  }
  return placed;
}

function colorFor(type: RoomSpec["type"]): string {
  // Soft category colors
  switch (type) {
    case "master_bedroom":
    case "bedroom":
      return "#fef3c7"; // amber-100
    case "bathroom":
      return "#bae6fd"; // sky-200
    case "kitchen":
      return "#fed7aa"; // orange-200
    case "living":
    case "dining":
      return "#d1fae5"; // emerald-100
    case "balcony":
    case "terrace":
    case "garden":
      return "#bbf7d0"; // green-200
    case "stairs":
    case "lift":
    case "lobby":
      return "#e5e7eb"; // gray-200
    case "reception":
    case "cabin":
    case "meeting_room":
    case "workstation_area":
    case "cafeteria":
      return "#ddd6fe"; // violet-200
    case "retail_unit":
      return "#fce7f3"; // pink-200
    case "study":
    case "pooja":
      return "#fef9c3"; // yellow-100
    default:
      return "#f3f4f6";
  }
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!)
  );
}

export function renderFloorPlanSvg(
  floor: FloorPlan,
  req: Requirements,
  footprint: { widthFt: number; depthFt: number },
  locale: Locale = "en",
  drawText: SvgTextDrawer = svgText
): FloorPlanSvg {
  const placed = placeRooms(floor.rooms, footprint.widthFt);
  // Compute actual bounding box from placements
  const usedW = Math.max(footprint.widthFt, ...placed.map((p) => p.x + p.r.widthFt));
  const usedD = Math.max(footprint.depthFt, ...placed.map((p) => p.y + p.r.depthFt));

  const svgW = usedW * SCALE + PADDING * 2;
  const svgH = usedD * SCALE + PADDING * 2 + LABEL_H;

  const rects = placed.map((p) => {
    const x = PADDING + p.x * SCALE;
    const y = PADDING + LABEL_H + p.y * SCALE;
    const w = p.r.widthFt * SCALE;
    const h = p.r.depthFt * SCALE;
    const fill = colorFor(p.r.type);
    const dims = `${p.r.widthFt}'×${p.r.depthFt}'`;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}"
              fill="${fill}" stroke="#374151" stroke-width="1.5" rx="2"/>
        ${drawText(p.r.name, x + w / 2, y + h / 2 - 4, {
          size: Math.max(9, Math.min(14, w / 7)),
          bold: true,
          fill: "#111827",
          anchor: "middle",
        })}
        ${drawText(
          // Narrow rooms only have space for the dimensions.
          w < 100 ? dims : `${dims} (${format("design.plan.areaShort", locale, { value: p.r.areaSqft })})`,
          x + w / 2,
          y + h / 2 + 12,
          { size: Math.max(8, Math.min(11, w / 10)), fill: "#374151", anchor: "middle" }
        )}
      </g>`;
  });

  // Outer plot boundary (dashed) — shows usable footprint
  const plotRect = `
    <rect x="${PADDING}" y="${PADDING + LABEL_H}"
          width="${footprint.widthFt * SCALE}" height="${footprint.depthFt * SCALE}"
          fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,4"/>`;

  // Compass / facing
  const facing = req.plot.facing ?? "N";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${drawText(format("design.plan.heading", locale, { label: floor.label, net: floor.netSqft }), PADDING, PADDING + 18, {
      size: 16,
      bold: true,
      fill: "#111827",
    })}
    ${drawText(
      format("design.plan.facing", locale, { facing: translate(`design.facing.${facing}`, locale), scale: SCALE }),
      PADDING,
      PADDING + 36,
      { size: 12, fill: "#6b7280" }
    )}
    ${plotRect}
    ${rects.join("\n")}
  </svg>`;

  return { floor: floor.floor, label: floor.label, svg };
}

export function renderAllFloors(
  floors: FloorPlan[],
  req: Requirements,
  footprint: { widthFt: number; depthFt: number },
  locale: Locale = "en",
  drawText?: SvgTextDrawer
): FloorPlanSvg[] {
  return floors.map((f) => renderFloorPlanSvg(f, req, footprint, locale, drawText));
}
