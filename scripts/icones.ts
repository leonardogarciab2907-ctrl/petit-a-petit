// Gera os ícones do app (PNG e SVG) sem dependências: três degraus subindo, "pouco a pouco".
// Uso: npm run icones
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(out, { recursive: true });

type RGB = [number, number, number];
const BLUE: RGB = [29, 78, 216];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [230, 57, 70];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  color: RGB;
}

/** Desenho em coordenadas 0–1. `pad` encolhe o desenho (ícone maskable precisa de margem). */
function shapes(full: boolean, pad: number): Rect[] {
  const s = (v: number) => pad + v * (1 - 2 * pad);
  const bg: Rect = full ? { x: 0, y: 0, w: 1, h: 1, r: 0, color: BLUE } : { x: 0, y: 0, w: 1, h: 1, r: 0.22, color: BLUE };
  const bars = [
    { x: 0.2, h: 0.22, color: WHITE },
    { x: 0.415, h: 0.38, color: WHITE },
    { x: 0.63, h: 0.54, color: RED },
  ];
  const base = 0.78;
  return [
    bg,
    ...bars.map((b) => ({ x: s(b.x), y: s(base - b.h), w: 0.17 * (1 - 2 * pad), h: b.h * (1 - 2 * pad), r: 0.035 * (1 - 2 * pad), color: b.color })),
  ];
}

function inside(px: number, py: number, q: Rect): boolean {
  if (px < q.x || px > q.x + q.w || py < q.y || py > q.y + q.h) return false;
  const cx = Math.min(Math.max(px, q.x + q.r), q.x + q.w - q.r);
  const cy = Math.min(Math.max(py, q.y + q.r), q.y + q.h - q.r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= q.r ** 2;
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size: number, full: boolean, pad: number): Buffer {
  const list = shapes(full, pad);
  const SS = 4; // supersampling para bordas suaves
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          let col: RGB | null = null;
          for (const q of list) if (inside(px, py, q)) col = q.color;
          if (col) {
            r += col[0];
            g += col[1];
            b += col[2];
            a += 1;
          }
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = SS * SS;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function svg(): string {
  const hex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rects = shapes(false, 0)
    .map((q) => `<rect x="${q.x * 64}" y="${q.y * 64}" width="${q.w * 64}" height="${q.h * 64}" rx="${q.r * 64}" fill="${hex(q.color)}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${rects}</svg>\n`;
}

writeFileSync(join(out, 'icon-192.png'), png(192, false, 0));
writeFileSync(join(out, 'icon-512.png'), png(512, false, 0));
writeFileSync(join(out, 'icon-maskable-512.png'), png(512, true, 0.1));
writeFileSync(join(out, 'apple-touch-icon.png'), png(180, true, 0));
writeFileSync(join(out, 'favicon.svg'), svg());
console.log('Ícones gerados em public/');
