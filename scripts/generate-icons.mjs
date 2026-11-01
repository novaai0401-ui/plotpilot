import { mkdirSync, writeFileSync, existsSync } from "fs";
import { createRequire } from "module";

/** Draws the app icon: a white map pin marking a plot, on the brand teal. */

const require = createRequire(import.meta.url);
const { Resvg } = require("@resvg/resvg-js");

const TEAL = "#0f766e";
const MARK = `
  <path fill="#ffffff" d="M256 92c-67 0-120 53-120 119 0 86 120 209 120 209s120-123 120-209c0-66-53-119-120-119z"/>
  <rect x="204" y="159" width="104" height="104" rx="10" fill="${TEAL}"/>
  <path d="M256 159v104M204 211h104" stroke="#ffffff" stroke-width="10"/>`;

function svg({ background, round, scale = 1 }) {
  const shift = 256 * (1 - scale);
  const bg = !background
    ? ""
    : round
      ? `<circle cx="256" cy="256" r="256" fill="${TEAL}"/>`
      : `<rect width="512" height="512" fill="${TEAL}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}
    <g transform="translate(${shift} ${shift}) scale(${scale})">${MARK}</g></svg>`;
}

function write(path, size, options) {
  const png = new Resvg(svg(options), { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(path, png);
}

write("public/icons/icon-192.png", 192, { background: true });
write("public/icons/icon-512.png", 512, { background: true });

const RES = "android/app/src/main/res";
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

if (existsSync(RES)) {
  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = `${RES}/mipmap-${density}`;
    mkdirSync(dir, { recursive: true });
    write(`${dir}/ic_launcher.png`, size, { background: true });
    write(`${dir}/ic_launcher_round.png`, size, { background: true, round: true });
    // Android crops adaptive icons, so the mark sits inside the safe zone.
    write(`${dir}/ic_launcher_foreground.png`, (size * 9) / 4, { scale: 0.62 });
  }
}
