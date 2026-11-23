// The app's icons: a blackjack — the ace of spades and the king of hearts,
// fanned — with a gold "21" chip, on green felt, for the PWA / home screen;
// and a simplified favicon (one bold ace and the chip) for browser tabs as
// favicon.svg, favicon-32.png and favicon.ico. Rasterised with headless
// Chrome (no dependencies; set CHROME to the browser if it isn't
// found). Adapted from Bridge-Master/scripts/make-icons.mjs.
//
//   node scripts/make-icons.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

// Shapes from src/ui/cards/cardArt.ts (suits in a 100 × 100 box, glyphs in 10 × 14).
const SPADE = 'M50 3C62 22 96 39 96 62C96 77 85 85 73 85C64 85 57 80 53 73C54 84 58 92 67 98H33C42 92 46 84 47 73C43 80 36 85 27 85C15 85 4 77 4 62C4 39 38 22 50 3Z';
const HEART = 'M50 94C24 74 3 57 3 32C3 15 15 5 29 5C39 5 46 11 50 20C54 11 61 5 71 5C85 5 97 15 97 32C97 57 76 74 50 94Z';
const GLYPH = {
  A: 'M0.8 14L5 0.2L9.2 14M2.3 9.2H7.7',
  K: 'M1.2 0.2V14M8.8 0.2L1.5 8.4M4 5.7L9.2 14',
  2: 'M1.1 3.7C1.3 1.3 3 0 5 0C7.4 0 8.9 1.6 8.9 3.8C8.9 6.3 6.9 7.8 5.2 9.4L1 13.8H9.2',
  1: 'M0.3 2.7L2.8 0.2V14',
};

const glyph = (g, x, y, s, color, w = 2.6) => `<path transform="translate(${x} ${y}) scale(${s})" d="${GLYPH[g]}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

function card(rot, cx, letter, suitPath, ink) {
  return (
    `<g transform="rotate(${rot} ${cx} 74)">` +
    `<rect x="${cx - 19}" y="15" width="38" height="55" rx="5" fill="#04150f" opacity=".35" transform="translate(2 2.6)"/>` +
    `<rect x="${cx - 19}" y="15" width="38" height="55" rx="5" fill="url(#card)" stroke="#0b2a1f" stroke-opacity=".3" stroke-width="1"/>` +
    `<rect x="${cx - 16.6}" y="17.4" width="33.2" height="50.2" rx="3.2" fill="none" stroke="${ink}" stroke-opacity=".14" stroke-width=".8"/>` +
    glyph(letter, cx - 15.2, 19.4, 0.62, ink) +
    `<path transform="translate(${cx - 10.5} ${33}) scale(.21)" d="${suitPath}" fill="${ink}"/>` +
    `</g>`
  );
}

/** The art in a 100 × 100 box. `bleed`: a full square (maskable / iOS) with the art scaled into the safe zone. */
function svg({ bleed = false } = {}) {
  const spots = Array.from({ length: 8 }, (_, i) => `<rect x="77.2" y="66.6" width="3.6" height="4.6" rx="1" fill="#fff6d8" transform="rotate(${i * 45} 79 81)"/>`).join('');
  const art =
    card(-14, 42, 'A', SPADE, '#1b2132') +
    card(11, 58, 'K', HEART, '#d22e3e') +
    // the chip
    `<circle cx="79" cy="81" r="15" fill="#04150f" opacity=".35" transform="translate(1.4 2)"/>` +
    `<circle cx="79" cy="81" r="14.4" fill="url(#gold)" stroke="#8d6518" stroke-width="1"/>` +
    spots +
    `<circle cx="79" cy="81" r="9.6" fill="#c8243a" stroke="#fff6d8" stroke-opacity=".7" stroke-width=".8" stroke-dasharray="1.6 1.2"/>` +
    glyph(2, 73.9, 77, 0.52, '#fff6d8', 2.9) +
    glyph(1, 79.6, 77, 0.52, '#fff6d8', 2.9);
  const defs =
    `<defs>` +
    `<radialGradient id="felt" cx=".5" cy=".36" r=".78"><stop offset="0" stop-color="#2a8762"/><stop offset=".6" stop-color="#155a41"/><stop offset="1" stop-color="#0a3022"/></radialGradient>` +
    `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".55" stop-color="#e9c46a"/><stop offset="1" stop-color="#c2902c"/></linearGradient>` +
    `<linearGradient id="card" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fffef8"/><stop offset="1" stop-color="#ece3cd"/></linearGradient>` +
    `</defs>`;
  const bg = bleed
    ? `<rect width="100" height="100" fill="url(#felt)"/>`
    : `<rect width="100" height="100" rx="22" fill="url(#felt)"/><rect x="3.5" y="3.5" width="93" height="93" rx="19" fill="none" stroke="#e9c46a" stroke-opacity=".35" stroke-width="1.2"/>`;
  const body = bleed ? `<g transform="translate(12 12) scale(.76)">${art}</g>` : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs}${bg}${body}</svg>`;
}

/**
 * The favicon: the same idea simplified for 16–48 px tabs — one bold ace of
 * spades and the red "21" chip, big shapes, no fine lines.
 */
function faviconSvg() {
  const spots = Array.from({ length: 6 }, (_, i) => `<rect x="70.5" y="50.5" width="5" height="7" rx="1.4" fill="#fff6d8" transform="rotate(${i * 60} 73 72)"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs>` +
    `<radialGradient id="felt" cx=".5" cy=".36" r=".8"><stop offset="0" stop-color="#2a8762"/><stop offset=".6" stop-color="#155a41"/><stop offset="1" stop-color="#0a3022"/></radialGradient>` +
    `<linearGradient id="card" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe7d2"/></linearGradient>` +
    `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".55" stop-color="#e9c46a"/><stop offset="1" stop-color="#c2902c"/></linearGradient>` +
    `</defs>` +
    `<rect width="100" height="100" rx="22" fill="url(#felt)"/>` +
    `<g transform="rotate(-10 42 50)">` +
    `<rect x="17" y="12" width="50" height="72" rx="7" fill="#04150f" opacity=".4" transform="translate(2.5 3)"/>` +
    `<rect x="17" y="12" width="50" height="72" rx="7" fill="url(#card)"/>` +
    glyph('A', 22.5, 17, 1.0, '#1b2132', 2.9) +
    `<path transform="translate(26.5 34) scale(.37)" d="${SPADE}" fill="#1b2132"/>` +
    `</g>` +
    `<circle cx="73" cy="72" r="23" fill="#04150f" opacity=".4" transform="translate(1.5 2)"/>` +
    `<circle cx="73" cy="72" r="22" fill="url(#gold)" stroke="#8d6518" stroke-width="1.4"/>` +
    spots +
    `<circle cx="73" cy="72" r="15.5" fill="#c8243a" stroke="#fff6d8" stroke-opacity=".75" stroke-width="1.2"/>` +
    glyph(2, 64.2, 64.6, 0.92, '#fff6d8', 3.2) +
    glyph(1, 74.6, 64.6, 0.92, '#fff6d8', 3.2) +
    `</svg>`
  );
}

/** An .ico holding PNG images (every modern browser and Windows read PNG-in-ICO). */
function writeIco(file, pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  writeFileSync(file, Buffer.concat([header, ...pngs.map((p) => p.data)]));
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome found; set CHROME to a Chrome / Edge / Chromium binary.');
  return found;
}

function rasterise(chrome, markup, size, file, tmp) {
  const html = join(tmp, `${size}.html`);
  writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${file}`,
    pathToFileURL(html).href,
  ], { stdio: 'ignore' });
}

const chrome = findChrome();
const tmp = mkdtempSync(join(tmpdir(), 'bj-icons-'));
try {
  // Tabs: the simplified favicon (SVG, a 32 px PNG, and an .ico with 16 / 32 / 48).
  writeFileSync(join(out, 'favicon.svg'), faviconSvg());
  rasterise(chrome, faviconSvg(), 32, join(out, 'favicon-32.png'), tmp);
  const sizes = [16, 32, 48];
  for (const n of sizes) rasterise(chrome, faviconSvg(), n, join(tmp, `fav-${n}.png`), tmp);
  writeIco(join(out, 'favicon.ico'), sizes.map((n) => ({ size: n, data: readFileSync(join(tmp, `fav-${n}.png`)) })));
  // Home screen and the PWA: the full art.
  rasterise(chrome, svg(), 192, join(out, 'icon-192.png'), tmp);
  rasterise(chrome, svg(), 512, join(out, 'icon-512.png'), tmp);
  rasterise(chrome, svg({ bleed: true }), 512, join(out, 'icon-maskable-512.png'), tmp);
  rasterise(chrome, svg({ bleed: true }), 180, join(out, 'apple-touch-icon.png'), tmp);
  console.log('icons written to', out);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
