// news-image-20261117
// Sums up 17 November 2026 world news in a single 1024x1024 PNG front page.
// Pure computation: Node stdlib only (node:fs, node:path, node:zlib).
// No network, no randomness, no timestamps -- two runs are byte-identical.
// Draws with its own PNG encoder and its own 5x7 bitmap font.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---- palette ----
const PAPER = [247, 243, 232]; // #F7F3E8 off-white paper
const INK = [26, 26, 26];
const WHITE = [255, 255, 255];
const RULE = [26, 26, 26];
const GREY = [90, 86, 76];
const LIGHT = [238, 232, 214];

// ---- pixel buffer (RGB, row-major) ----
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function frameRect(x, y, w, h, c, t) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

// Bresenham line.
function drawLine(x0, y0, x1, y1, c, t) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (;;) {
    fillRect(x - half, y - half, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}

function ringCircle(cx, cy, r, c, t) {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(rad));
    const y = Math.round(cy + r * Math.sin(rad));
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}

// ---- CRC32 (PNG chunk checksums) ----
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE.push(c >>> 0);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte 0 + RGB rows.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font (7 rows of 5 bits, bit 4 = leftmost pixel) ----
// All text is rendered in capitals, so only A-Z, 0-9 and punctuation
// are defined. Unknown characters render as a blank.
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '–': [0, 0, 0, 14, 0, 0, 0],
  '—': [0, 0, 0, 31, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '%': [25, 26, 2, 4, 8, 11, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '/': [1, 2, 2, 4, 8, 8, 16],
};

// A character cell is 6 units wide (5 + 1 spacing) and 7 units tall.
function charWidth(scale) {
  return 6 * scale;
}

function textWidth(text, scale) {
  return text.length * charWidth(scale) - scale; // no trailing space
}

function drawChar(ch, x, y, scale, c) {
  const glyph = FONT[ch] ?? FONT[' '];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(text, x, y, scale, c) {
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    drawChar(upper[i], x + i * charWidth(scale), y, scale, c);
  }
}

function drawTextCentered(text, cx, y, scale, c) {
  const w = textWidth(text.toUpperCase(), scale);
  drawText(text, cx - Math.floor(w / 2), y, scale, c);
}

// Greedy word wrap: returns lines that fit maxWidth pixels.
function wrapText(text, scale, maxWidth) {
  const words = text.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const trial = cur === '' ? word : cur + ' ' + word;
    if (textWidth(trial, scale) <= maxWidth || cur === '') {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---- geometric icons, one per story (drawn inside a 96x52 box) ----
// 1. Kerch bridge: two towers, a deck with a collapsed middle span, water.
function iconBridge(x, y, c) {
  fillRect(x + 6, y + 6, 8, 30, c); // left tower
  fillRect(x + 82, y + 6, 8, 30, c); // right tower
  fillRect(x + 2, y + 2, 16, 5, c); // left tower cap
  fillRect(x + 78, y + 2, 16, 5, c); // right tower cap
  fillRect(x, y + 22, 34, 5, c); // deck, left span
  fillRect(x + 62, y + 22, 34, 5, c); // deck, right span
  // collapsed middle span, tilted down
  drawLine(x + 34, y + 24, x + 48, y + 36, c, 5);
  drawLine(x + 48, y + 36, x + 62, y + 24, c, 5);
  // suspension cables
  drawLine(x + 10, y + 7, x + 34, y + 22, GREY, 2);
  drawLine(x + 86, y + 7, x + 62, y + 22, GREY, 2);
  // water
  drawLine(x + 2, y + 42, x + 30, y + 42, c, 2);
  drawLine(x + 40, y + 47, x + 70, y + 47, c, 2);
  drawLine(x + 66, y + 42, x + 94, y + 42, c, 2);
}

// 2. Trump in Manila: a jet flying over a flag.
function iconPlane(x, y, c) {
  // flag pole + flag
  fillRect(x + 6, y + 4, 3, 44, INK);
  fillRect(x + 9, y + 4, 26, 9, c);
  fillRect(x + 9, y + 13, 26, 9, WHITE);
  frameRect(x + 9, y + 4, 26, 18, INK, 1);
  // jet: fuselage, swept wing, tail fin
  fillRect(x + 40, y + 24, 52, 7, c);
  drawLine(x + 46, y + 24, x + 54, y + 10, c, 4); // tail fin
  drawLine(x + 62, y + 31, x + 74, y + 44, c, 4); // swept wing
  fillRect(x + 88, y + 25, 6, 5, INK); // nose
  // motion dashes
  fillRect(x + 32, y + 26, 6, 2, GREY);
}

// 3. Iran and the Gulf: a tanker on waves, a drone above it.
function iconTanker(x, y, c) {
  // drone
  fillCircle(x + 72, y + 10, 5, INK);
  drawLine(x + 62, y + 6, x + 82, y + 6, INK, 2); // rotor
  drawLine(x + 72, y + 15, x + 72, y + 22, GREY, 2);
  // tanker hull
  fillRect(x + 6, y + 28, 76, 12, c);
  fillRect(x + 82, y + 32, 8, 8, c); // bow
  fillRect(x + 14, y + 20, 14, 8, INK); // bridge block
  fillRect(x + 32, y + 22, 4, 6, INK); // funnel
  // waves
  drawLine(x + 2, y + 45, x + 26, y + 45, c, 2);
  drawLine(x + 34, y + 48, x + 58, y + 48, c, 2);
  drawLine(x + 66, y + 45, x + 94, y + 45, c, 2);
}

// 4. Banks go down: a bank building with a falling arrow.
function iconBank(x, y, c) {
  // pediment
  drawLine(x + 48, y + 2, x + 14, y + 16, c, 3);
  drawLine(x + 48, y + 2, x + 82, y + 16, c, 3);
  fillRect(x + 14, y + 16, 68, 3, c);
  // columns
  fillRect(x + 18, y + 20, 6, 20, c);
  fillRect(x + 34, y + 20, 6, 20, c);
  fillRect(x + 56, y + 20, 6, 20, c);
  fillRect(x + 72, y + 20, 6, 20, c);
  // base
  fillRect(x + 12, y + 40, 72, 4, c);
  fillRect(x + 8, y + 44, 80, 4, INK);
  // red down arrow on the right
  drawLine(x + 88, y + 6, x + 88, y + 26, [185, 28, 28], 4);
  drawLine(x + 82, y + 20, x + 88, y + 28, [185, 28, 28], 4);
  drawLine(x + 94, y + 20, x + 88, y + 28, [185, 28, 28], 4);
}

// 5. Nvidia after the bell: a chip with pins and a rising bar.
function iconChip(x, y, c) {
  // pins
  for (let i = 0; i < 4; i++) {
    fillRect(x + 12 + i * 12, y + 2, 4, 6, INK);
    fillRect(x + 12 + i * 12, y + 44, 4, 6, INK);
    fillRect(x + 2, y + 12 + i * 8, 6, 4, INK);
    fillRect(x + 52, y + 12 + i * 8, 6, 4, INK);
  }
  fillRect(x + 8, y + 8, 44, 36, c); // chip body
  fillRect(x + 18, y + 18, 24, 16, WHITE); // die
  fillRect(x + 24, y + 22, 12, 8, c);
  // rising bars on the right
  fillRect(x + 66, y + 38, 7, 10, c);
  fillRect(x + 76, y + 30, 7, 18, c);
  fillRect(x + 86, y + 22, 7, 26, c);
  drawLine(x + 64, y + 26, x + 94, y + 12, [21, 128, 61], 3); // trend line
}

// 6. UK sanctions settlers: houses behind a ban circle.
function iconBan(x, y, c) {
  // two small houses
  fillRect(x + 6, y + 26, 22, 18, c);
  drawLine(x + 4, y + 26, x + 17, y + 16, c, 3);
  drawLine(x + 30, y + 26, x + 17, y + 16, c, 3);
  fillRect(x + 34, y + 30, 18, 14, GREY);
  drawLine(x + 32, y + 30, x + 43, y + 22, GREY, 3);
  drawLine(x + 54, y + 30, x + 43, y + 22, GREY, 3);
  // ban circle with slash
  ringCircle(x + 76, y + 18, 16, [185, 28, 28], 5);
  drawLine(x + 65, y + 7, x + 87, y + 29, [185, 28, 28], 5);
}


// ---- the six stories of 17 November 2026 (facts only) ----
const STORIES = [
  {
    headline: 'KERCH BRIDGE HIT',
    caption:
      'Ukraine strikes the bridge linking Russia to occupied Crimea; a road span collapses. Zelenskyy calls it an "unprecedented operation".',
    source: 'BBC',
    band: [185, 28, 28],
    icon: iconBridge,
  },
  {
    headline: 'TRUMP IN MANILA',
    caption:
      'Trump arrives in the Philippines for the ASEAN summit and signs a joint trade statement with Thailand. His Asia trip ends with talks with Xi and Putin in China.',
    source: 'AP',
    band: [29, 78, 216],
    icon: iconPlane,
  },
  {
    headline: 'IRAN STRIKES IN THE GULF',
    caption:
      "Iran fires drones at a US radar base in Bahrain; Iran's Revolutionary Guards say two oil tankers hit mines in the Strait of Hormuz.",
    source: 'AL JAZEERA / REUTERS',
    band: [15, 118, 110],
    icon: iconTanker,
  },
  {
    headline: 'BANKS GO DOWN',
    caption:
      'JPMorgan Chase blames a software bug for Monday\'s banking outage that hit online banking and Zelle payments.',
    source: 'ABC NEWS / AP',
    band: [180, 83, 9],
    icon: iconBank,
  },
  {
    headline: 'NVIDIA AFTER THE BELL',
    caption:
      'Nvidia reports quarterly earnings after the market close, its first since co-founder Jensen Huang resigned as CEO.',
    source: 'LEVEL HEADLINES',
    band: [21, 128, 61],
    icon: iconChip,
  },
  {
    headline: 'UK SANCTIONS SETTLERS',
    caption:
      'Britain sanctions eight Israeli construction firms building settlements in the occupied West Bank.',
    source: 'BBC',
    band: [109, 40, 217],
    icon: iconBan,
  },
];

// ---- layout ----
const MARGIN = 32;
const GRID_TOP = 188;
const GRID_BOTTOM = 962;
const GAP = 16;
const PANEL_W = Math.floor((W - MARGIN * 2 - GAP) / 2);
const PANEL_H = Math.floor((GRID_BOTTOM - GRID_TOP - GAP * 2) / 3);

function drawPanel(s, px0, py0) {
  fillRect(px0, py0, PANEL_W, PANEL_H, WHITE);
  frameRect(px0, py0, PANEL_W, PANEL_H, INK, 2);
  fillRect(px0 + 2, py0 + 2, PANEL_W - 4, 10, s.band);
  // icon, left-aligned with padding
  s.icon(px0 + 16, py0 + 24, s.band);
  // headline to the right of the icon
  const headX = px0 + 128;
  const headW = PANEL_W - 128 - 16;
  const headLines = wrapText(s.headline, 3, headW);
  let y = py0 + 30;
  for (const line of headLines) {
    drawText(line, headX, y, 3, INK);
    y += 27;
  }
  // caption across the full panel width, below the icon
  const capLines = wrapText(s.caption, 2, PANEL_W - 32);
  let cy = py0 + 96;
  for (const line of capLines) {
    drawText(line, px0 + 16, cy, 2, INK);
    cy += 21;
  }
  // source credit pinned to the panel foot
  fillRect(px0 + 16, py0 + PANEL_H - 40, PANEL_W - 32, 2, LIGHT);
  drawText('SOURCE: ' + s.source, px0 + 16, py0 + PANEL_H - 30, 2, GREY);
}

function drawMasthead() {
  drawTextCentered('THE WORLD IN ONE DAY', W / 2, 26, 2, GREY);
  drawTextCentered('TUESDAY 17 NOVEMBER 2026', W / 2, 58, 5, INK);
  fillRect(MARGIN, 116, W - MARGIN * 2, 4, RULE);
  fillRect(MARGIN, 124, W - MARGIN * 2, 2, RULE);
  drawTextCentered('SIX STORIES THAT DEFINED THE DAY', W / 2, 140, 2, GREY);
}

function drawFooter() {
  fillRect(MARGIN, 972, W - MARGIN * 2, 2, RULE);
  drawTextCentered(
    'ALL EVENTS OF 17 NOVEMBER 2026, AS REPORTED THAT DAY',
    W / 2,
    982,
    2,
    GREY,
  );
  drawTextCentered('SOURCES: BBC, AP, REUTERS, ABC NEWS', W / 2, 1002, 2, GREY);
}

function main() {
  drawMasthead();
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (PANEL_W + GAP);
    const y = GRID_TOP + row * (PANEL_H + GAP);
    drawPanel(STORIES[i], x, y);
  }
  drawFooter();

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
