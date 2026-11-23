// Casino chips, drawn in code like the cards: a standalone SVG per
// denomination cached as a data URL. Edge spots, an inlay ring, the value in
// stroked digits.

import { digitsSvg } from '../cards/cardArt';

export const DENOMS = [1, 5, 25, 100, 500, 1000] as const;
export type Denom = (typeof DENOMS)[number];

const STYLE: Record<Denom, { base: string; dark: string; spot: string; ink: string; inlay: string }> = {
  1: { base: '#f1ede3', dark: '#cfc8b8', spot: '#2f63b8', ink: '#22407a', inlay: '#fbf9f3' },
  5: { base: '#c8243a', dark: '#8e1424', spot: '#f6f1e6', ink: '#ffffff', inlay: '#d8384c' },
  25: { base: '#1f8a4c', dark: '#11592f', spot: '#f6f1e6', ink: '#ffffff', inlay: '#2b9c5a' },
  100: { base: '#1e2027', dark: '#0b0c10', spot: '#e9c46a', ink: '#f3d98f', inlay: '#2b2e37' },
  500: { base: '#6b2fa3', dark: '#45186f', spot: '#f5d64e', ink: '#fff2b0', inlay: '#7c3fb6' },
  1000: { base: '#e3a51e', dark: '#a8740d', spot: '#1e2027', ink: '#2a1c00', inlay: '#efb83a' },
};

function chipSvg(d: Denom): string {
  const s = STYLE[d];
  const spots = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45;
    return `<rect x="45" y="2.5" width="10" height="13" rx="2" fill="${s.spot}" transform="rotate(${a} 50 50)"/>`;
  }).join('');
  const ticks = Array.from({ length: 32 }, (_, i) => `<rect x="49.2" y="17.5" width="1.6" height="3.2" rx=".6" fill="${s.spot}" opacity=".7" transform="rotate(${i * 11.25 + 5.6} 50 50)"/>`).join('');
  const label = digitsSvg(String(d), 50, 50, d >= 1000 ? 13 : d >= 100 ? 15 : 17, s.ink, d >= 100 ? 2.6 : 2.8);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs><radialGradient id="b" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>` +
    `<circle cx="50" cy="50" r="48.5" fill="${s.base}" stroke="${s.dark}" stroke-width="1.5"/>` +
    spots +
    `<circle cx="50" cy="50" r="33" fill="${s.inlay}" stroke="${s.dark}" stroke-opacity=".5" stroke-width="1"/>` +
    ticks +
    `<circle cx="50" cy="50" r="26" fill="${s.base}" stroke="${s.spot}" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 2.4"/>` +
    label +
    `<circle cx="50" cy="50" r="48.5" fill="url(#b)"/>` +
    `</svg>`
  );
}

const cache = new Map<Denom, string>();

export function chipSrc(d: Denom): string {
  let src = cache.get(d);
  if (!src) {
    src = `data:image/svg+xml,${encodeURIComponent(chipSvg(d))}`;
    cache.set(d, src);
  }
  return src;
}

/** Break an amount into chips, biggest first (fractions — a 3:2 payout on $5 — show as a $1 chip). */
export function chipsFor(amount: number, maxChips = 12): Denom[] {
  const out: Denom[] = [];
  let left = Math.round(amount);
  for (let i = DENOMS.length - 1; i >= 0 && out.length < maxChips; i--) {
    const d = DENOMS[i]!;
    while (left >= d && out.length < maxChips) {
      out.push(d);
      left -= d;
    }
  }
  if (out.length === 0 && amount > 0) out.push(1);
  return out.reverse();
}

export function formatMoney(x: number, sign = false): string {
  const abs = Math.abs(x);
  const s = abs % 1 === 0 ? abs.toLocaleString('en-US') : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pre = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return `${pre}$${s}`;
}
