// Generates simple solid-color PNG icons for PWA use.
// Run with: node scripts/generate-icons.mjs
// No third-party deps — uses node:zlib + buffer for raw PNG encoding.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// Brand colors — black background, white check mark.
const BG = [10, 10, 10, 255];
const FG = [245, 245, 245, 255];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xED_B8_83_20 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xFF_FF_FF_FF;
  for (const byte of buf) c = table[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFF_FF_FF_FF) >>> 0;
}

// Draws a rounded-square background with a stylized check mark.
function drawIcon(maskable) {
  return (x, y, size) => {
    const radius = maskable ? 0 : size * 0.22;
    const padding = maskable ? size * 0.1 : 0;
    if (!maskable) {
      const inLeft = x >= radius && x <= size - radius;
      const inTop = y >= radius && y <= size - radius;
      if (!(inLeft || inTop)) {
        const cx = x < size / 2 ? radius : size - radius;
        const cy = y < size / 2 ? radius : size - radius;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
      }
    }
    // Check mark: two line segments inside a centered square.
    const s = size - padding * 2;
    const px = (x - padding) / s;
    const py = (y - padding) / s;
    if (px < 0 || px > 1 || py < 0 || py > 1) return BG;
    const stroke = 0.08;
    // Segment 1: from (0.22, 0.55) to (0.45, 0.75)
    if (onSegment(px, py, 0.22, 0.55, 0.45, 0.75, stroke)) return FG;
    // Segment 2: from (0.45, 0.75) to (0.78, 0.32)
    if (onSegment(px, py, 0.45, 0.75, 0.78, 0.32, stroke)) return FG;
    return BG;
  };
}

function encodePng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Filtered raw data: 1 filter byte (0) per row + RGBA pixels.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (const [i, b] of pixels.subarray(y * width * 4, (y + 1) * width * 4).entries()) {
      raw[y * (1 + width * 4) + 1 + i] = b;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makePixels(size, draw) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const i = (y * size + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

function onSegment(px, py, x1, y1, x2, y2, w) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey <= (w / 2) * (w / 2);
}

function writeIcon(name, size, maskable) {
  const pixels = makePixels(size, drawIcon(maskable));
  const png = encodePng(size, size, pixels);
  const path = join(outDir, name);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

writeIcon("icon-192.png", 192, false);
writeIcon("icon-512.png", 512, false);
writeIcon("icon-512-maskable.png", 512, true);
writeIcon("apple-touch-icon.png", 180, false);
