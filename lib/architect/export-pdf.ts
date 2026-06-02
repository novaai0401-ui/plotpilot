import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import type { DesignBrief } from "./rules";
import type { Requirements } from "./requirements";

type FloorPlanSvg = { floor: number; label: string; svg: string };

/**
 * Build a multi-page PDF of a building design:
 *  - Cover with title + summary KPIs + optional concept render
 *  - Narrative page(s)
 *  - One page per floor: rasterized SVG floor plan (resvg-js) + room schedule (including per-room cost)
 *  - Materials / MEP / Code-notes appendix
 *
 * SVG rasterization uses @resvg/resvg-js (pure Rust binding, no headless browser
 * needed) so the printed plan matches the on-screen view exactly.
 *
 * Returns a Uint8Array PDF buffer.
 */

export type PdfInput = {
  requirements: Requirements;
  brief: DesignBrief;
  narrative: string | null;
  floorPlansSvg: FloorPlanSvg[];
  renderImageUrl: string | null;
  generatedAt: Date;
  designId: string;
};

const MARGIN = 50;
const BRAND_RGB = rgb(15 / 255, 118 / 255, 110 / 255); // brand teal
const GRAY = rgb(0.35, 0.35, 0.35);

export async function buildDesignPdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Building Design — ${input.requirements.projectType}`);
  pdf.setProducer("PlotBroker AI Architect");
  pdf.setCreator("PlotBroker");

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  await drawCoverPage(pdf, input, fontRegular, fontBold);
  if (input.narrative) drawNarrative(pdf, input.narrative, fontRegular, fontBold);
  for (const floor of input.brief.floors) {
    const svgRow = input.floorPlansSvg.find((s) => s.floor === floor.floor);
    await drawFloorPage(pdf, floor, input.requirements, fontRegular, fontBold, svgRow?.svg);
  }
  drawAppendix(pdf, input.brief, fontRegular, fontBold);

  return await pdf.save();
}

async function drawCoverPage(
  pdf: PDFDocument,
  input: PdfInput,
  fontRegular: PDFFont,
  fontBold: PDFFont
) {
  const page = pdf.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText("Building Design", { x: MARGIN, y, size: 28, font: fontBold, color: BRAND_RGB });
  y -= 36;
  page.drawText(
    `${labelForType(input.requirements.projectType)} · ${input.brief.summary.totalSqftPlot} sqft plot`,
    { x: MARGIN, y, size: 13, font: fontRegular, color: GRAY }
  );
  y -= 18;
  page.drawText(`Generated ${input.generatedAt.toLocaleString()} · ID ${input.designId.slice(0, 8)}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontRegular,
    color: GRAY,
  });
  y -= 30;

  // Render image if available
  if (input.renderImageUrl) {
    try {
      const res = await fetch(input.renderImageUrl);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        const buf = new Uint8Array(await res.arrayBuffer());
        let img;
        if (ct.includes("png")) img = await pdf.embedPng(buf);
        else if (ct.includes("jpeg") || ct.includes("jpg")) img = await pdf.embedJpg(buf);
        // WebP not supported by pdf-lib; skip
        if (img) {
          const imgW = width - MARGIN * 2;
          const imgH = (img.height / img.width) * imgW;
          page.drawImage(img, { x: MARGIN, y: y - imgH, width: imgW, height: imgH });
          y -= imgH + 20;
        }
      }
    } catch {
      // Non-fatal — just skip the image
    }
  }

  // KPI grid
  const kpis: [string, string][] = [
    ["Plot area", `${input.brief.summary.totalSqftPlot} sqft`],
    ["Built-up planned", `${input.brief.summary.plannedBuiltUpSqft} sqft`],
    ["FAR used", `${input.brief.summary.farUsedPct}%`],
    ["Floors", String(input.brief.summary.floors)],
    [
      "Footprint",
      `${input.brief.summary.footprintWidthFt}' × ${input.brief.summary.footprintDepthFt}'`,
    ],
  ];
  if (input.brief.costEstimateInr) {
    kpis.push([
      "Est. cost",
      `₹${(input.brief.costEstimateInr.low / 100000).toFixed(0)}L – ₹${(input.brief.costEstimateInr.high / 100000).toFixed(0)}L`,
    ]);
  }

  const colW = (width - MARGIN * 2) / 3;
  const rowH = 50;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * colW;
    const ky = y - row * rowH;
    page.drawRectangle({
      x,
      y: ky - rowH + 8,
      width: colW - 8,
      height: rowH - 8,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    });
    page.drawText(kpis[i][0], { x: x + 8, y: ky - 12, size: 8, font: fontRegular, color: GRAY });
    page.drawText(kpis[i][1], {
      x: x + 8,
      y: ky - 30,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  // Warnings
  if (input.brief.warnings.length) {
    y -= Math.ceil(kpis.length / 3) * rowH + 14;
    page.drawText("⚠ Warnings", { x: MARGIN, y, size: 12, font: fontBold, color: rgb(0.7, 0.5, 0) });
    y -= 16;
    for (const w of input.brief.warnings) {
      page.drawText(`• ${w}`, { x: MARGIN, y, size: 9, font: fontRegular, color: GRAY, maxWidth: width - MARGIN * 2 });
      y -= 14;
    }
  }
}

function drawNarrative(pdf: PDFDocument, narrative: string, fontRegular: PDFFont, fontBold: PDFFont) {
  // Strip markdown for plain text rendering
  const text = narrative
    .replace(/^##\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`/g, "");

  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;
  page.drawText("Design brief", { x: MARGIN, y, size: 20, font: fontBold, color: BRAND_RGB });
  y -= 24;

  const lines = wrapText(text, fontRegular, 11, width - MARGIN * 2);
  for (const ln of lines) {
    if (y < MARGIN + 14) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - MARGIN;
    }
    page.drawText(ln, { x: MARGIN, y, size: 11, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
    y -= 15;
  }
}

async function drawFloorPage(
  pdf: PDFDocument,
  floor: DesignBrief["floors"][number],
  req: Requirements,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  svgSource?: string
) {
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText(floor.label, { x: MARGIN, y, size: 20, font: fontBold, color: BRAND_RGB });
  y -= 24;
  const floorCost = (floor as any).floorCostInr as number | undefined;
  const costStr = floorCost ? ` · est. ₹${(floorCost / 100000).toFixed(1)}L` : "";
  page.drawText(
    `Net area: ${floor.netSqft} sqft · ${floor.rooms.length} rooms${costStr}`,
    { x: MARGIN, y, size: 10, font: fontRegular, color: GRAY }
  );
  y -= 18;

  // --- Floor plan (rasterized SVG) ---
  let planEmbedded = false;
  if (svgSource) {
    try {
      const targetWidthPx = Math.round((width - MARGIN * 2) * 2); // 2x for clarity
      const resvg = new Resvg(svgSource, {
        fitTo: { mode: "width", value: targetWidthPx },
        background: "white",
      });
      const png = resvg.render().asPng();
      const img = await pdf.embedPng(png);
      const dispW = width - MARGIN * 2;
      const dispH = (img.height / img.width) * dispW;
      const cappedH = Math.min(dispH, 420); // leave room for room schedule on same page
      const scaledW = (cappedH / dispH) * dispW;
      const xOffset = MARGIN + (dispW - scaledW) / 2;
      page.drawImage(img, { x: xOffset, y: y - cappedH, width: scaledW, height: cappedH });
      y -= cappedH + 16;
      planEmbedded = true;
    } catch (e) {
      console.warn("[architect/pdf] SVG rasterize failed; falling back to PDF native rectangles", e);
    }
  }

  // Fallback: redraw rooms as PDF rectangles if rasterization unavailable
  if (!planEmbedded) {
    const footprintW = Math.max(40, req.plot.frontageFt ?? Math.sqrt(req.plot.totalSqft));
    const usableW = footprintW - req.plot.setbackSideFt * 2;
    const scale = (width - MARGIN * 2) / Math.max(1, usableW);
    let cursorX = MARGIN;
    let cursorY = y;
    let rowHeight = 0;
    const sorted = [...floor.rooms].sort((a, b) => b.areaSqft - a.areaSqft);
    for (const r of sorted) {
      const w = r.widthFt * scale;
      const h = r.depthFt * scale;
      if (cursorX + w > width - MARGIN && cursorX > MARGIN) {
        cursorX = MARGIN;
        cursorY -= rowHeight;
        rowHeight = 0;
      }
      if (cursorY - h < MARGIN + 150) break;
      page.drawRectangle({
        x: cursorX,
        y: cursorY - h,
        width: w,
        height: h,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.7,
      });
      const fontSize = Math.max(5, Math.min(8, w / 14));
      page.drawText(r.name, {
        x: cursorX + 3,
        y: cursorY - 10,
        size: fontSize,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: w - 6,
      });
      cursorX += w;
      rowHeight = Math.max(rowHeight, h);
    }
    y = cursorY - rowHeight - 24;
  }

  // --- Room schedule (may overflow onto next page) ---
  if (y < MARGIN + 100) {
    page = pdf.addPage([595, 842]);
    y = page.getSize().height - MARGIN;
  }
  page.drawText("Room schedule", { x: MARGIN, y, size: 12, font: fontBold });
  y -= 16;
  const hasCost = floor.rooms.some((r) => (r as any).costInr != null);
  const colXs = hasCost
    ? [MARGIN, MARGIN + 170, MARGIN + 270, MARGIN + 340, MARGIN + 420]
    : [MARGIN, MARGIN + 200, MARGIN + 300, MARGIN + 380];
  page.drawText("Room", { x: colXs[0], y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Type", { x: colXs[1], y, size: 9, font: fontBold, color: GRAY });
  page.drawText("W × D", { x: colXs[2], y, size: 9, font: fontBold, color: GRAY });
  page.drawText("Area", { x: colXs[3], y, size: 9, font: fontBold, color: GRAY });
  if (hasCost) page.drawText("Est. cost", { x: colXs[4], y, size: 9, font: fontBold, color: GRAY });
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 12;
  for (const r of floor.rooms) {
    if (y < MARGIN + 14) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - MARGIN;
    }
    page.drawText(r.name, { x: colXs[0], y, size: 9, font: fontRegular });
    page.drawText(r.type, { x: colXs[1], y, size: 9, font: fontRegular, color: GRAY });
    page.drawText(`${r.widthFt}' × ${r.depthFt}'`, { x: colXs[2], y, size: 9, font: fontRegular });
    page.drawText(`${r.areaSqft} sqft`, { x: colXs[3], y, size: 9, font: fontRegular });
    if (hasCost) {
      const c = (r as any).costInr as number | undefined;
      page.drawText(c ? `₹${formatINR(c)}` : "—", {
        x: colXs[4],
        y,
        size: 9,
        font: fontRegular,
      });
    }
    y -= 13;
  }
}

function formatINR(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function drawAppendix(pdf: PDFDocument, brief: DesignBrief, fontRegular: PDFFont, fontBold: PDFFont) {
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;
  page.drawText("Specifications & code", { x: MARGIN, y, size: 20, font: fontBold, color: BRAND_RGB });
  y -= 28;

  const sections: [string, string[]][] = [
    ["Materials", brief.materials],
    ["MEP recommendations", brief.mep],
    ["Code & compliance notes", brief.codeNotes],
  ];

  for (const [title, items] of sections) {
    if (y < MARGIN + 30) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - MARGIN;
    }
    page.drawText(title, { x: MARGIN, y, size: 13, font: fontBold });
    y -= 16;
    for (const item of items) {
      const lines = wrapText(`• ${item}`, fontRegular, 10, width - MARGIN * 2 - 10);
      for (const ln of lines) {
        if (y < MARGIN + 14) {
          page = pdf.addPage([595, 842]);
          y = page.getSize().height - MARGIN;
        }
        page.drawText(ln, { x: MARGIN + 10, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
    }
    y -= 8;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function labelForType(t: string): string {
  return (
    {
      residential_house: "Residential house",
      residential_apartment: "Residential apartment",
      commercial_office: "Commercial office",
      commercial_retail: "Commercial retail",
      mixed_use: "Mixed-use building",
    }[t] || t
  );
}
