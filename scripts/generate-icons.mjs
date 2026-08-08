// Generates REX OS PWA icons (pure Node, no deps — zlib is built-in).
// Outputs to public/icons/: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
//
// Run: bun scripts/generate-icons.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");

// ---------- minimal PNG encoder (RGBA 8-bit) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- tiny math helpers ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hexVertices(cx, cy, r, rotation = 0) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = rotation + (i * Math.PI) / 3;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return pts;
}

function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function distToPolygon(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    d = Math.min(d, distToSegment(px, py, ax, ay, bx, by));
  }
  return d;
}

// rounded-rect distance (negative inside)
function roundedRectDist(px, py, cx, cy, half, r) {
  const qx = Math.abs(px - cx) - (half - r);
  const qy = Math.abs(py - cy) - (half - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// ---------- render ----------
const C0 = [16, 25, 46]; // #10192e
const C1 = [10, 15, 30]; // #0a0f1e
const CYAN = [56, 232, 255];
const VIOLET = [139, 92, 246];
const MAGENTA = [255, 92, 122];

function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function renderIcon(size, { maskable = false, content = 1 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const S = size;
  const cx = S / 2;
  const cy = S / 2;
  const cornerR = maskable ? S * 0.0 : S * 0.24;
  const hexR = S * 0.3 * content;
  const hexStroke = S * 0.045 * content;
  // bolt in unit space relative to hex bounding box
  const boltPts = [
    [0.42, 0.2],
    [0.72, 0.52],
    [0.55, 0.52],
    [0.6, 0.8],
    [0.3, 0.46],
    [0.46, 0.46],
  ].map(([u, v]) => [cx + (u - 0.5) * 2 * hexR, cy + (v - 0.5) * 2 * hexR]);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px2 = x + 0.5;
      const py2 = y + 0.5;
      const i = (y * S + x) * 4;
      let r, g, b, a;

      if (!maskable) {
        const dRect = roundedRectDist(px2, py2, cx, cy, S / 2, cornerR);
        if (dRect > 0) {
          a = 0;
          px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
          continue;
        }
      }

      const bg = mix(C0, C1, (x + y) / (2 * S));
      r = bg[0];
      g = bg[1];
      b = bg[2];
      a = 255;

      // bolt fill (cyan -> violet gradient)
      if (pointInPolygon(px2, py2, boltPts)) {
        const col = mix(CYAN, VIOLET, (x + y) / (2 * S));
        r = col[0];
        g = col[1];
        b = col[2];
      } else {
        const edge = distToPolygon(px2, py2, boltPts);
        if (edge < 1.2) {
          const aa = clamp01(1.2 - edge);
          const col = mix(CYAN, VIOLET, (x + y) / (2 * S));
          r = lerp(r, col[0], aa);
          g = lerp(g, col[1], aa);
          b = lerp(b, col[2], aa);
        }
      }

      // hexagon stroke
      const verts = hexVertices(cx, cy, hexR, 0.5); // pointy-top
      const dHex = distToPolygon(px2, py2, verts);
      const halfW = hexStroke / 2;
      if (dHex < halfW + 1.2) {
        const aa = clamp01(halfW + 1.2 - dHex);
        const col = CYAN;
        r = lerp(r, col[0], aa);
        g = lerp(g, col[1], aa);
        b = lerp(b, col[2], aa);
      }

      // magenta node dot (top-left of hexagon)
      const dotCx = cx - hexR * 0.82;
      const dotCy = cy - hexR * 0.82;
      const dDot = Math.hypot(px2 - dotCx, py2 - dotCy);
      const dotR = S * 0.028 * content;
      if (dDot < dotR + 1.2) {
        const aa = clamp01(dotR + 1.2 - dDot);
        r = lerp(r, MAGENTA[0], aa);
        g = lerp(g, MAGENTA[1], aa);
        b = lerp(b, MAGENTA[2], aa);
      }

      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(a);
    }
  }
  return encodePng(S, S, px);
}

mkdirSync(OUT, { recursive: true });

const jobs = [
  ["icon-192.png", renderIcon(192)],
  ["icon-512.png", renderIcon(512)],
  ["maskable-512.png", renderIcon(512, { maskable: true, content: 0.62 })],
  ["apple-touch-icon.png", renderIcon(180)],
];

for (const [name, buf] of jobs) {
  writeFileSync(join(OUT, name), buf);
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
}
