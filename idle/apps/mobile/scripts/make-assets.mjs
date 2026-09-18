// "IDLE" — the icon, generated from the brand rules rather than drawn once.
//
// BRAND.md §09: a pure INK square, "IDLE" in PAPER, Inter Tight 700, optically
// centred, quotation marks included, occupying 72% of the tile width.
//
//   node scripts/make-assets.mjs
//
// Inter Tight must be visible to fontconfig. The font ships with the app:
//   cp ../../node_modules/@expo-google-fonts/inter-tight/700Bold/*.ttf ~/.fonts/
//   fc-cache -f

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const INK = "#0A0A0A";
const PAPER = "#F4F1EA";

/** The wordmark. Straight double quotes, always — they are the logo. */
function wordmark({ size, widthRatio, background, foreground }) {
  // Inter Tight Bold at 1000upm: '"IDLE"' is ~3.05em wide at -0.04em tracking.
  const fontSize = Math.round((size * widthRatio) / 3.05);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <text x="50%" y="50%"
        font-family="Inter Tight" font-weight="700" font-size="${fontSize}"
        letter-spacing="${(-0.04 * fontSize).toFixed(2)}"
        fill="${foreground}"
        text-anchor="middle" dominant-baseline="central">&#34;IDLE&#34;</text>
</svg>`);
}

const TARGETS = [
  // App icon: the word occupies 72% of the tile.
  { file: "icon.png", size: 1024, widthRatio: 0.72, background: INK, foreground: PAPER },
  // Android adaptive foreground: the OS masks ~33% away, so the safe zone is
  // the centre circle. Shrink the word and keep the tile transparent-free.
  { file: "adaptive-icon.png", size: 1024, widthRatio: 0.46, background: INK, foreground: PAPER },
  // Splash: the same mark, small, on the same black. Nothing else happens here.
  { file: "splash.png", size: 1284, widthRatio: 0.44, background: INK, foreground: PAPER },
  // Notification icon: monochrome, Android tints it.
  { file: "notification-icon.png", size: 96, widthRatio: 0.8, background: "#00000000", foreground: PAPER },
  // Favicon for the web build.
  { file: "favicon.png", size: 48, widthRatio: 0.82, background: INK, foreground: PAPER },
];

mkdirSync(OUT, { recursive: true });

for (const target of TARGETS) {
  const png = await sharp(wordmark(target), { density: 384 }).png().toBuffer();
  writeFileSync(join(OUT, target.file), png);
  console.log(`${target.file.padEnd(22)} ${target.size}px`);
}
