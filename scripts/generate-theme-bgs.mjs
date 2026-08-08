// Generates REX OS anime-theme background artwork (pure Node, no deps).
// Outputs 1280x720 PNGs to:
//   public/themes/luffy/background.png
//   public/themes/naruto/background.png
//   public/themes/goku/background.png
//
// The art is abstract "energy field" gradients in each character's palette.
// Replace these files with your own images (keep the same filenames) and the
// dashboard updates automatically.
//
// Run: bun scripts/generate-theme-bgs.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "themes");

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

// ---------- color math ----------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(255, v));

function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---------- renderer ----------
const W = 1280;
const H = 720;

function renderBackground({ top, bottom, glows }) {
  const px = Buffer.alloc(W * H * 4);
  const cx = W / 2;
  const cy = H / 2;

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const i = (y * W + x) * 4;

      // base vertical gradient with a slight horizontal drift
      let base = mix(top, bottom, Math.pow(v, 0.85) + 0.06 * Math.sin(u * Math.PI * 2));
      let r = base[0];
      let g = base[1];
      let b = base[2];

      // energy glows
      for (const glow of glows) {
        const dx = x - glow.cx * W;
        const dy = y - glow.cy * H;
        const d2 = dx * dx + dy * dy;
        const sigma = glow.radius * W * 0.34;
        const strength = Math.exp(-d2 / (2 * sigma * sigma)) * glow.strength;
        r += glow.color[0] * strength;
        g += glow.color[1] * strength;
        b += glow.color[2] * strength;
      }

      // soft light rays sweeping up from the bottom edge
      const rx = x - cx;
      const ry = y - H * 1.1;
      const angle = Math.atan2(ry, rx);
      const band = Math.sin(angle * 13) * 0.5 + 0.5;
      const rayFade = Math.max(0, 1 - v * 1.15);
      const ray = band * rayFade * 0.05;
      r += 255 * ray;
      g += 255 * ray;
      b += 255 * ray;

      // vignette
      const vdx = (x - cx) / cx;
      const vdy = (y - cy) / cy;
      const vig = Math.min(1, (vdx * vdx + vdy * vdy) * 0.28);
      r *= 1 - vig;
      g *= 1 - vig;
      b *= 1 - vig;

      px[i] = clamp(Math.round(r));
      px[i + 1] = clamp(Math.round(g));
      px[i + 2] = clamp(Math.round(b));
      px[i + 3] = 255;
    }
  }

  return encodePng(W, H, px);
}

// ---------- theme palettes ----------
const THEMES = {
  luffy: {
    top: [26, 14, 26], // deep maroon-navy
    bottom: [7, 8, 13],
    glows: [
      { color: [239, 68, 68], cx: 0.24, cy: 0.18, radius: 0.52, strength: 0.5 },
      { color: [249, 115, 22], cx: 0.8, cy: 0.8, radius: 0.44, strength: 0.32 },
    ],
  },
  naruto: {
    top: [23, 17, 42], // deep indigo
    bottom: [7, 7, 13],
    glows: [
      { color: [249, 115, 22], cx: 0.22, cy: 0.2, radius: 0.52, strength: 0.52 },
      { color: [251, 191, 36], cx: 0.78, cy: 0.74, radius: 0.42, strength: 0.3 },
    ],
  },
  goku: {
    top: [13, 22, 40], // deep space blue
    bottom: [5, 7, 13],
    glows: [
      { color: [56, 189, 248], cx: 0.2, cy: 0.16, radius: 0.56, strength: 0.48 },
      { color: [251, 191, 36], cx: 0.82, cy: 0.78, radius: 0.4, strength: 0.28 },
    ],
  },
};

for (const [id, palette] of Object.entries(THEMES)) {
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const buf = renderBackground(palette);
  writeFileSync(join(dir, "background.png"), buf);
  console.log(`wrote public/themes/${id}/background.png (${buf.length} bytes)`);
}
