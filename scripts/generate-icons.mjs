/**
 * Pure-Node PNG icon generator (no native image deps).
 *
 * Draws the Kenshi brand mark — a rounded dark tile with a blue "K" glyph — into an
 * RGBA pixel buffer and encodes a valid PNG using only Node's zlib. Produces the
 * full PWA icon set + the Android mipmap set so `npm run icons` is reproducible.
 *
 * The mark here is a clean placeholder the user can replace with an approved logo;
 * re-running regenerates every size from one source routine.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BG = [11, 15, 26]; // #0b0f1a
const BG2 = [27, 34, 54]; // #1b2236
const ACCENT = [79, 124, 255]; // #4f7cff

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest 0
  // raw scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Render a single icon at size n.
function renderIcon(n) {
  const buf = Buffer.alloc(n * n * 4);
  const radius = n * 0.22;
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * n + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  const inRounded = (x, y) => {
    const rx = Math.min(x, n - 1 - x);
    const ry = Math.min(y, n - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx;
    const dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };

  // Background: vertical gradient inside rounded tile, transparent outside.
  for (let y = 0; y < n; y++) {
    const t = y / n;
    const bg = lerp(BG, BG2, t);
    for (let x = 0; x < n; x++) {
      if (inRounded(x, y)) set(x, y, bg, 255);
      else set(x, y, [0, 0, 0], 0);
    }
  }

  // Draw a bold "K" in accent. Built from 3 strokes.
  const m = n * 0.26; // margin
  const sw = Math.max(2, Math.round(n * 0.11)); // stroke width
  const top = m;
  const bot = n - m;
  const left = m;
  const drawRectStroke = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (x >= 0 && y >= 0 && x < n && y < n) set(x, y, ACCENT, 255);
  };
  // Vertical bar of the K
  drawRectStroke(left, top, left + sw, bot);
  // Two diagonals from the middle.
  const midY = (top + bot) / 2;
  const reach = n - m;
  for (let i = 0; i <= reach - (left + sw); i++) {
    const x = left + sw + i;
    const yUp = Math.round(midY - i);
    const yDn = Math.round(midY + i);
    for (let s = 0; s < sw; s++) {
      if (yUp + s >= 0 && yUp + s < n && x < n) set(x, yUp + s, ACCENT, 255);
      if (yDn - s >= 0 && yDn - s < n && x < n) set(x, yDn - s, ACCENT, 255);
    }
  }
  return encodePng(n, n, buf);
}

const PWA_SIZES = [48, 72, 96, 128, 192, 256, 384, 512];
// Android mipmap launcher sizes (mdpi..xxxhdpi) for ic_launcher.
const ANDROID = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

function writeIcon(path, size) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderIcon(size));
}

for (const s of PWA_SIZES) {
  writeIcon(resolve(ROOT, `public/icons/icon-${s}.png`), s);
}
// Android icons live under the Capacitor android project once it exists; we also
// emit them to android-notes/ so they're available even before `cap add android`.
for (const [dpi, s] of ANDROID) {
  writeIcon(resolve(ROOT, `android-notes/res/mipmap-${dpi}/ic_launcher.png`), s);
  writeIcon(resolve(ROOT, `android-notes/res/mipmap-${dpi}/ic_launcher_round.png`), s);
}

console.log(
  `Generated ${PWA_SIZES.length} PWA icons + ${ANDROID.length * 2} Android icons.`,
);
