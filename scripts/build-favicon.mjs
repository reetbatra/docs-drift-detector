// One-off: rasterize app/icon.svg into a multi-size PNG-embedded favicon.ico.
// Run with `node scripts/build-favicon.mjs`. sharp ships transitively with Next.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../app/icon.svg", import.meta.url));
const sizes = [16, 32, 48];

const pngs = await Promise.all(
  sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()),
);

// ICONDIR header (6 bytes) + one ICONDIRENTRY (16 bytes) per image.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(pngs.length, 4); // image count

const entries = [];
let offset = 6 + 16 * pngs.length;
pngs.forEach((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0); // width (0 => 256)
  e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1); // height
  e.writeUInt8(0, 2); // palette count
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8); // bytes in resource
  e.writeUInt32LE(offset, 12); // offset to PNG data
  offset += png.length;
  entries.push(e);
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync(new URL("../app/favicon.ico", import.meta.url), ico);
console.log(`Wrote app/favicon.ico — ${ico.length} bytes, sizes: ${sizes.join(", ")}`);
