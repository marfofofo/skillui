// IDLE — the icon, generated from the brand rules rather than drawn once.
//
// BRAND.md §08: the canvas square, and a single lamp with its bloom, optically
// centred at 22% of the tile width. No word, no glyph, no gradient background.
//
//   node scripts/make-assets.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const CANVAS = "#08090B";
const LAMP = "#FFC16B";

/** One warm light in a dark room. The three shadows of §04, as one gradient. */
function lamp({ size, lampRatio, background }) {
  const r = (size * lampRatio) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const bloom = r * 4.2;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${LAMP}" stop-opacity="0.55"/>
      <stop offset="28%"  stop-color="${LAMP}" stop-opacity="0.26"/>
      <stop offset="60%"  stop-color="${LAMP}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${LAMP}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${background === "none" ? "" : `<rect width="${size}" height="${size}" fill="${background}"/>`}
  <circle cx="${cx}" cy="${cy}" r="${bloom}" fill="url(#bloom)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${LAMP}"/>
</svg>`);
}

const TARGETS = [
  { file: "icon.png", size: 1024, lampRatio: 0.22, background: CANVAS },
  // Android masks ~33% away, so the lamp shrinks to stay inside the safe circle.
  { file: "adaptive-icon.png", size: 1024, lampRatio: 0.15, background: CANVAS },
  { file: "splash.png", size: 1284, lampRatio: 0.055, background: CANVAS },
  // Android tints the notification icon, so it ships as a flat silhouette.
  { file: "notification-icon.png", size: 96, lampRatio: 0.34, background: "none" },
  { file: "favicon.png", size: 64, lampRatio: 0.3, background: CANVAS },
];

mkdirSync(OUT, { recursive: true });

for (const target of TARGETS) {
  const png = await sharp(lamp(target), { density: 384 }).png().toBuffer();
  writeFileSync(join(OUT, target.file), png);
  console.log(`${target.file.padEnd(22)} ${target.size}px`);
}
