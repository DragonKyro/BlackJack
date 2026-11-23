// Display helpers for the bet spread analyzer (pure, so they're testable).

import { TCS, type Spread } from './betSpread';

/** Clean axis ticks from 0 up to at least `max` (1, 2, 2.5 or 5 × 10ⁿ steps). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(Math.round(v * 1e9) / 1e9);
  return out;
}

/** Symmetric-ish ticks covering [min, max] (min ≤ 0 ≤ max), sharing one step. */
export function divergingTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(Math.abs(min), Math.abs(max));
  const up = niceTicks(span, count);
  const step = up.length > 1 ? up[1]! : 1;
  const lo = min < 0 ? -Math.ceil(-min / step - 1e-9) : 0;
  const hi = max > 0 ? Math.ceil(max / step - 1e-9) : 0;
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) out.push(Math.round(k * step * 1e9) / 1e9 + 0);
  return out;
}

/** 950 → "950", 12 900 → "12.9K", 63 000 → "63K", 1 200 000 → "1.2M". */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${trim(a / 1e6)}M`;
  if (a >= 1e4) return `${s}${trim(a / 1e3)}K`;
  return `${s}${Math.round(a).toLocaleString('en-US')}`;
}

function trim(x: number): string {
  return x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, '');
}

export type Level = 'good' | 'warning' | 'critical';

/** Risk of ruin as a traffic light. */
export function rorLevel(ror: number): { level: Level; text: string } {
  if (ror < 5) return { level: 'good', text: 'Low risk' };
  if (ror < 20) return { level: 'warning', text: 'Moderate risk' };
  return { level: 'critical', text: 'High risk' };
}

export const MAX_BET_UNITS = 50;

/** Set one count's bet (clamped 0…MAX_BET_UNITS). */
export function withBet(spread: Spread, tc: number, units: number): Spread {
  return { ...spread, [tc]: Math.max(0, Math.min(MAX_BET_UNITS, Math.round(units))) };
}

/** A full copy over every true count (missing counts bet 1 unit). */
export function fullSpread(s: Spread): Spread {
  return Object.fromEntries(TCS.map((tc) => [tc, s[tc] ?? 1]));
}

export function sameSpread(a: Spread, b: Spread): boolean {
  return TCS.every((tc) => (a[tc] ?? 1) === (b[tc] ?? 1));
}

/** "+2", "−3", "0" for a true count. */
export function tcLabel(tc: number): string {
  return tc > 0 ? `+${tc}` : tc < 0 ? `−${-tc}` : '0';
}
