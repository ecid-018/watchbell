/* ------------------------------------------------------------------
   One-shot icon generator: a ship's bell on the dark teal ground.

   Run once with `npm run icons`. The PNGs are committed, so no later
   build — and no build at sea — needs sharp or a network.
------------------------------------------------------------------ */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const GROUND = "#0E1C22"; // THEME.dark.card — the brief's dark theme colour
const BELL = "#E9B255";   // THEME.dark.amber
const LINE = "#6FB9A6";   // THEME.dark.foam

/**
 * @param {number} inset fraction of the canvas left as margin around the glyph.
 *   ~0.10 for a normal icon, ~0.20 for maskable (Android crops to a circle).
 */
const svg = (size, inset) => {
  const s = 512;
  // Glyph is authored in a 512 box then scaled to fit the safe area.
  const scale = 1 - inset * 2;
  const off = s * inset;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${GROUND}"/>
  <g transform="translate(${off} ${off}) scale(${scale})">
    <!-- crown loop -->
    <path d="M256 60 a30 30 0 0 1 30 30 a30 30 0 0 1-30 30 a30 30 0 0 1-30-30 a30 30 0 0 1 30-30 z
             M256 84 a6 6 0 0 0-6 6 a6 6 0 0 0 6 6 a6 6 0 0 0 6-6 a6 6 0 0 0-6-6 z"
          fill="${BELL}"/>
    <!-- yoke -->
    <rect x="240" y="116" width="32" height="20" rx="6" fill="${BELL}"/>
    <!-- bell body: shoulders flaring to a wide mouth -->
    <path d="M256 136
             c-52 0-84 34-96 92
             c-10 48-22 78-42 104
             c-6 8-2 18 8 18
             h260
             c10 0 14-10 8-18
             c-20-26-32-56-42-104
             c-12-58-44-92-96-92 z"
          fill="${BELL}"/>
    <!-- lip -->
    <rect x="112" y="352" width="288" height="26" rx="13" fill="${BELL}"/>
    <!-- clapper -->
    <circle cx="256" cy="404" r="26" fill="${BELL}"/>
    <!-- waterline -->
    <rect x="150" y="452" width="212" height="7" rx="3.5" fill="${LINE}"/>
  </g>
</svg>`;
};

const render = async (name, size, inset) => {
  const buf = await sharp(Buffer.from(svg(size, inset))).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(OUT, name), buf);
  console.log(`  ${name.padEnd(26)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} kB`);
};

await mkdir(OUT, { recursive: true });
console.log("Watchbell icons →", OUT);

// Solid ground, no transparency and no pre-rounded corners: iOS applies its own mask.
await render("apple-touch-icon-180.png", 180, 0.1);
await render("icon-192.png", 192, 0.1);
await render("icon-512.png", 512, 0.1);
await render("icon-512-maskable.png", 512, 0.2);

console.log("done.");
