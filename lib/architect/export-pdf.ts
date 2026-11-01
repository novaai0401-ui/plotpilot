import { PDFDocument, rgb, PDFPage, type Color } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { format, translate, type Locale } from "@/lib/i18n/dict";
import { formatDateTime } from "@/lib/i18n/format";
import { renderAllFloors, type SvgTextDrawer } from "./floor-plan-svg";
import { buildableFootprint } from "./requirements";
import { measureText, outlineText, type Face } from "./text-outlines";
import type { DesignBrief } from "./rules";
import type { Requirements } from "./requirements";

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
 * All text is drawn as outlines (see text-outlines.ts) because the PDF standard
 * fonts cannot encode the rupee sign or Devanagari. Pass a brief already run
 * through localizeBrief; `locale` covers the document's own labels.
 *
 * Returns a Uint8Array PDF buffer.
 */

export type PdfInput = {
  requirements: Requirements;
  brief: DesignBrief;
  narrative: string | null;
  renderImageUrl: string | null;
  generatedAt: Date;
  designId: string;
  locale?: Locale;
};

const MARGIN = 50;
const BRAND_RGB = rgb(15 / 255, 118 / 255, 110 / 255); // brand teal
const GRAY = rgb(0.35, 0.35, 0.35);

export async function buildDesignPdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Building Design — ${input.requirements.projectType}`);
  pdf.setProducer("PlotBroker AI Architect");
  pdf.setCreator("PlotBroker");

  const locale = input.locale ?? "en";
  const svgs = renderAllFloors(
    input.brief.floors,
    input.requirements,
    buildableFootprint(input.requirements),
    locale,
    svgTextOutline
  );

  await drawCoverPage(pdf, input, locale);
  if (input.narrative) drawNarrative(pdf, input.narrative, locale);
  for (const floor of input.brief.floors) {
    const svgRow = svgs.find((s) => s.floor === floor.floor);
    await drawFloorPage(pdf, floor, input.requirements, locale, svgRow?.svg);
  }
  drawAppendix(pdf, input.brief, locale);

  return await pdf.save();
}

type TextStyle = { x: number; y: number; size: number; font?: Face; color?: Color };

function drawText(page: PDFPage, text: string, { x, y, size, font, color }: TextStyle) {
  for (const d of outlineText(text, size, font).glyphs) {
    page.drawSvgPath(d, { x, y, color: color ?? rgb(0, 0, 0), borderWidth: 0 });
  }
}

const svgTextOutline: SvgTextDrawer = (text, x, y, { size, bold, fill, anchor = "start" }) => {
  const { glyphs, width } = outlineText(text, size, bold ? "bold" : "regular");
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const paths = glyphs.map((d) => `<path d="${d}"/>`).join("");
  return `<g transform="translate(${left} ${y})" fill="${fill}">${paths}</g>`;
};

async function drawCoverPage(pdf: PDFDocument, input: PdfInput, locale: Locale) {
  const page = pdf.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  const t = (key: string) => translate(key, locale);
  const sqft = (value: number) => format("design.sqftValue", locale, { value });

  drawText(page, t("design.pdf.title"), { x: MARGIN, y, size: 28, font: "bold", color: BRAND_RGB });
  y -= 36;
  drawText(
    page,
    format("design.pdf.subtitle", locale, {
      type: t(`design.projectType.${input.requirements.projectType}`),
      area: input.brief.summary.totalSqftPlot,
    }),
    { x: MARGIN, y, size: 13, color: GRAY }
  );
  y -= 18;
  drawText(
    page,
    format("design.page.generated", locale, {
      date: formatDateTime(input.generatedAt, locale),
      id: input.designId.slice(0, 8),
    }),
    { x: MARGIN, y, size: 10, color: GRAY }
  );
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
    [t("design.viewer.plotArea"), sqft(input.brief.summary.totalSqftPlot)],
    [t("design.viewer.builtUp"), sqft(input.brief.summary.plannedBuiltUpSqft)],
    [t("design.viewer.farUsed"), `${input.brief.summary.farUsedPct}%`],
    [t("design.pdf.floors"), String(input.brief.summary.floors)],
    [
      t("design.viewer.footprint"),
      `${input.brief.summary.footprintWidthFt}' × ${input.brief.summary.footprintDepthFt}'`,
    ],
  ];
  if (input.brief.costEstimateInr) {
    kpis.push([
      t("design.viewer.estCost"),
      format("design.costRange", locale, {
        low: (input.brief.costEstimateInr.low / 100000).toFixed(0),
        high: (input.brief.costEstimateInr.high / 100000).toFixed(0),
      }),
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
    drawText(page, kpis[i][0], { x: x + 8, y: ky - 12, size: 8, color: GRAY });
    drawText(page, kpis[i][1], {
      x: x + 8,
      y: ky - 30,
      size: 14,
      font: "bold",
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  // Warnings
  if (input.brief.warnings.length) {
    y -= Math.ceil(kpis.length / 3) * rowH + 14;
    drawText(page, t("design.viewer.warnings"), { x: MARGIN, y, size: 12, font: "bold", color: rgb(0.7, 0.5, 0) });
    y -= 16;
    for (const w of input.brief.warnings) {
      for (const ln of wrapText(`• ${w}`, "regular", 9, width - MARGIN * 2)) {
        drawText(page, ln, { x: MARGIN, y, size: 9, color: GRAY });
        y -= 14;
      }
    }
  }
}

function drawNarrative(pdf: PDFDocument, narrative: string, locale: Locale) {
  // Strip markdown for plain text rendering
  const text = narrative
    .replace(/^##\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`/g, "");

  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;
  drawText(page, translate("design.viewer.brief", locale), { x: MARGIN, y, size: 20, font: "bold", color: BRAND_RGB });
  y -= 24;

  const lines = wrapText(text, "regular", 11, width - MARGIN * 2);
  for (const ln of lines) {
    if (y < MARGIN + 14) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - MARGIN;
    }
    drawText(page, ln, { x: MARGIN, y, size: 11, color: rgb(0.15, 0.15, 0.15) });
    y -= 17;
  }
}

async function drawFloorPage(
  pdf: PDFDocument,
  floor: DesignBrief["floors"][number],
  req: Requirements,
  locale: Locale,
  svgSource?: string
) {
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  drawText(page, floor.label, { x: MARGIN, y, size: 20, font: "bold", color: BRAND_RGB });
  y -= 24;
  const floorCost = (floor as any).floorCostInr as number | undefined;
  const costStr = floorCost
    ? ` · ${format("design.pdf.floorCost", locale, { amount: formatINR(floorCost, locale) })}`
    : "";
  drawText(
    page,
    `${format("design.pdf.floorSummary", locale, { net: floor.netSqft, rooms: floor.rooms.length })}${costStr}`,
    { x: MARGIN, y, size: 10, color: GRAY }
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
      drawText(page, r.name, {
        x: cursorX + 3,
        y: cursorY - 10,
        size: fontSize,
        font: "bold",
        color: rgb(0.1, 0.1, 0.1),
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
  const label = (key: string) => translate(key, locale);
  drawText(page, label("design.pdf.roomSchedule"), { x: MARGIN, y, size: 12, font: "bold" });
  y -= 16;
  const hasCost = floor.rooms.some((r) => (r as any).costInr != null);
  const colXs = hasCost
    ? [MARGIN, MARGIN + 170, MARGIN + 270, MARGIN + 340, MARGIN + 420]
    : [MARGIN, MARGIN + 200, MARGIN + 300, MARGIN + 380];
  const header = { y, size: 9, font: "bold" as const, color: GRAY };
  drawText(page, label("design.viewer.room"), { ...header, x: colXs[0] });
  drawText(page, label("design.viewer.type"), { ...header, x: colXs[1] });
  drawText(page, label("design.viewer.dimensions"), { ...header, x: colXs[2] });
  drawText(page, label("design.viewer.area"), { ...header, x: colXs[3] });
  if (hasCost) drawText(page, label("design.viewer.estCost"), { ...header, x: colXs[4] });
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
    drawText(page, r.name, { x: colXs[0], y, size: 9 });
    drawText(page, label(`design.roomType.${r.type}`), { x: colXs[1], y, size: 9, color: GRAY });
    drawText(page, `${r.widthFt}' × ${r.depthFt}'`, { x: colXs[2], y, size: 9 });
    drawText(page, format("design.sqftValue", locale, { value: r.areaSqft }), { x: colXs[3], y, size: 9 });
    if (hasCost) {
      const c = (r as any).costInr as number | undefined;
      drawText(page, c ? `₹${formatINR(c, locale)}` : "—", { x: colXs[4], y, size: 9 });
    }
    y -= 13;
  }
}

function formatINR(n: number, locale: Locale): string {
  if (n >= 10_000_000) return format("design.amount.crore", locale, { value: (n / 10_000_000).toFixed(2) });
  if (n >= 100_000) return format("design.amount.lakh", locale, { value: (n / 100_000).toFixed(1) });
  if (n >= 1_000) return format("design.amount.thousand", locale, { value: (n / 1_000).toFixed(0) });
  return String(n);
}

function drawAppendix(pdf: PDFDocument, brief: DesignBrief, locale: Locale) {
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;
  drawText(page, translate("design.pdf.specs", locale), { x: MARGIN, y, size: 20, font: "bold", color: BRAND_RGB });
  y -= 28;

  const sections: [string, string[]][] = [
    [translate("design.viewer.materials", locale), brief.materials],
    [translate("design.viewer.mep", locale), brief.mep],
    [translate("design.viewer.codeNotes", locale), brief.codeNotes],
  ];

  for (const [title, items] of sections) {
    if (y < MARGIN + 30) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - MARGIN;
    }
    drawText(page, title, { x: MARGIN, y, size: 13, font: "bold" });
    y -= 16;
    for (const item of items) {
      const lines = wrapText(`• ${item}`, "regular", 10, width - MARGIN * 2 - 10);
      for (const ln of lines) {
        if (y < MARGIN + 14) {
          page = pdf.addPage([595, 842]);
          y = page.getSize().height - MARGIN;
        }
        drawText(page, ln, { x: MARGIN + 10, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
        y -= 15;
      }
    }
    y -= 8;
  }
}

function wrapText(text: string, face: Face, size: number, maxWidth: number): string[] {
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
      if (measureText(test, size, face) > maxWidth) {
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
