import { readFileSync } from "fs";
import path from "path";
import { create as openFont, type Font } from "fontkit";

/**
 * Turns text into vector outlines for the PDF. pdf-lib's built-in fonts cannot
 * encode ₹ or Devanagari, and resvg collapses Devanagari vowel signs, so fontkit
 * shapes the text and both draw plain paths instead.
 */

export type Face = "regular" | "bold";
export type TextOutline = { glyphs: string[]; width: number };

const FILES: Record<Face, string> = {
  regular: "NotoSansDevanagari-Regular.ttf",
  bold: "NotoSansDevanagari-Bold.ttf",
};

const fonts = new Map<Face, Font>();

function loadFont(face: Face): Font {
  let font = fonts.get(face);
  if (!font) {
    const buffer = readFileSync(path.join(process.cwd(), "assets", "fonts", FILES[face]));
    font = openFont(buffer) as Font;
    fonts.set(face, font);
  }
  return font;
}

/** One path per glyph, with the origin on the text baseline and y pointing down. */
export function outlineText(text: string, size: number, face: Face = "regular"): TextOutline {
  const font = loadFont(face);
  const scale = size / font.unitsPerEm;
  const run = font.layout(text.replace(/≤/g, "<=")); // The font has no ≤ glyph.
  let x = 0;
  const glyphs: string[] = [];
  // Under the Next server fontkit can split "ां" with a ◌ placeholder; our text never contains one.
  const placeholder = font.glyphForCodePoint(0x25cc).id;
  run.glyphs.forEach((glyph, i) => {
    if (glyph.id === placeholder) return;
    const pos = run.positions[i];
    const d = glyph.path
      .scale(scale, -scale)
      .translate(x + pos.xOffset * scale, -pos.yOffset * scale)
      .toSVG();
    if (d) glyphs.push(d);
    x += pos.xAdvance * scale;
  });
  return { glyphs, width: x };
}

export function measureText(text: string, size: number, face: Face = "regular"): number {
  const font = loadFont(face);
  return (font.layout(text).advanceWidth * size) / font.unitsPerEm;
}
