// View helpers for the Stats page: filtering, the heatmap's colour scale,
// trainer roll-ups from sessions, and the metrics a session row shows.
// Pure — no React, no stores.

import { UP_COLS, type UpCol } from '@/bj/cards';
import type { Action, HandType } from '@/strategy/tables';
import { isRight, type Drill, type DrillMode } from './analytics';

export type ModeFilter = 'all' | DrillMode;

export function filterDrills(drills: readonly Drill[], mode: ModeFilter): Drill[] {
  return mode === 'all' ? drills.slice() : drills.filter((d) => d.mode === mode);
}

// ---------------------------------------------------------------- colour

/** The chart surface the heat colours sit on (the panel). */
export const SURFACE = '#13251f';
/** Status steps (fixed, reserved meaning) — see the dataviz palette. */
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' } as const;
/** Single-series mark colour (an in-band ochre gold for the dark panel; validated). */
export const SERIES_1 = '#b8892a';

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Error-rate stops (percent → colour): no errors recede toward the surface; misses get loud. */
export const HEAT_STOPS: readonly [number, string][] = [
  [0, mix(SURFACE, STATUS.good, 0.5)],
  [20, STATUS.warning],
  [40, STATUS.serious],
  [60, STATUS.critical],
];

function luminance(hex: string): number {
  const ch = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Fill and label ink for an error rate (null: no data). */
export function heatColor(rate: number | null): { bg: string; fg: string } | null {
  if (rate === null) return null;
  const r = Math.max(0, rate);
  let bg = HEAT_STOPS[HEAT_STOPS.length - 1]![1];
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [r1, c1] = HEAT_STOPS[i]!;
    const [r0, c0] = HEAT_STOPS[i - 1]!;
    if (r <= r1) {
      bg = mix(c0, c1, (r - r0) / (r1 - r0));
      break;
    }
  }
  return { bg, fg: luminance(bg) > 0.4 ? '#0b0b0b' : '#ffffff' };
}

export type Band = 'good' | 'warning' | 'critical';

/** The desktop app's accuracy bands: ≥ 90 good, ≥ 75 warning, else critical. */
export function bandOf(acc: number): Band {
  return acc >= 90 ? 'good' : acc >= 75 ? 'warning' : 'critical';
}

// ---------------------------------------------------------------- heatmap extras

/** The most recent right answer recorded for each cell (rules may have changed between sessions). */
export function cellAnswers(drills: readonly Drill[], type: HandType): Map<string, Action> {
  const m = new Map<string, Action>();
  for (const d of drills) if (d.type === type) m.set(`${d.row}|${d.up}`, d.ans);
  return m;
}

// ---------------------------------------------------------------- sessions

interface SessionLike {
  mode: 'counting' | 'bet' | 'smart' | 'play';
  ts: number;
  end: number;
  n: Record<string, number>;
}

const num = (n: Record<string, number>, k: string) => (Number.isFinite(n[k]) ? n[k]! : 0);
export const pctOf = (c: number, n: number): number | null => (n > 0 ? (c / n) * 100 : null);

export interface TrainerTotals {
  sessions: number;
  /** Summed counters across the mode's sessions. */
  n: Record<string, number>;
}

export function totals(sessions: readonly SessionLike[]): TrainerTotals {
  const n: Record<string, number> = {};
  for (const s of sessions)
    for (const [k, v] of Object.entries(s.n)) {
      // Setup values (seats, decks, speed, the ask flag) aren't summed meaningfully; keep the last.
      if (k === 'seats' || k === 'decks' || k === 'speedMs' || k === 'askRc') n[k] = v;
      else n[k] = (n[k] ?? 0) + (Number.isFinite(v) ? v : 0);
    }
  return { sessions: sessions.length, n };
}

export interface Metric {
  label: string;
  value: string;
  /** Good / bad tint for the value (text only — never colour alone). */
  tone?: 'pos' | 'neg';
}

const pctStr = (c: number, n: number) => {
  const p = pctOf(c, n);
  return p === null ? '—' : `${Math.round(p)}%`;
};

function signedStr(x: number, unit: '$' | 'u'): string {
  const abs = Math.abs(x);
  const body = unit === '$' ? `$${abs % 1 === 0 ? abs.toLocaleString('en-US') : abs.toFixed(2)}` : `${abs % 1 === 0 ? abs : abs.toFixed(1)}u`;
  return x > 0 ? `+${body}` : x < 0 ? `−${body}` : body;
}

/** The figures a session row (or a trainer roll-up) shows. */
export function sessionMetrics(mode: SessionLike['mode'], n: Record<string, number>): Metric[] {
  const v = (k: string) => num(n, k);
  const out: Metric[] = [];
  const net = (unit: '$' | 'u') => {
    const x = v('net');
    out.push({ label: 'Net', value: signedStr(x, unit), tone: x > 0 ? 'pos' : x < 0 ? 'neg' : undefined });
  };
  switch (mode) {
    case 'counting':
      out.push({ label: 'Exact', value: pctStr(v('exact'), v('polls')) });
      out.push({ label: 'Within ±1', value: pctStr(v('close'), v('polls')) });
      out.push({ label: 'Avg miss', value: v('polls') > 0 ? (v('absErr') / v('polls')).toFixed(1) : '—' });
      out.push({ label: 'Checks', value: String(v('polls')) });
      out.push({ label: 'Cards', value: v('cards').toLocaleString('en-US') });
      break;
    case 'bet':
      out.push({ label: v('askRc') ? 'Running count' : 'True count', value: pctStr(v('checksOk'), v('checks')) });
      out.push({ label: 'Bets', value: pctStr(v('betsOk'), v('bets')) });
      out.push({ label: 'Rounds', value: String(v('rounds')) });
      net('u');
      break;
    case 'smart':
      out.push({ label: v('askRc') ? 'Running count' : 'True count', value: pctStr(v('checksOk'), v('checks')) });
      out.push({ label: 'Bets', value: pctStr(v('betsOk'), v('bets')) });
      out.push({ label: 'Plays', value: pctStr(v('playsOk'), v('plays')) });
      out.push({ label: 'Rounds', value: String(v('rounds')) });
      net('u');
      break;
    case 'play':
      out.push({ label: 'Hands', value: String(v('hands')) });
      out.push({ label: 'W · L · P', value: `${v('won')} · ${v('lost')} · ${v('pushed')}` });
      out.push({ label: 'Blackjacks', value: String(v('blackjacks')) });
      if (v('plays') > 0) out.push({ label: 'Plays', value: pctStr(v('playsOk'), v('plays')) });
      net('$');
      break;
  }
  return out;
}

/** The one number a session is charted by on the Trend tab (null: nothing to chart). */
export function sessionHeadline(mode: SessionLike['mode'], n: Record<string, number>): number | null {
  if (mode === 'counting') return pctOf(num(n, 'exact'), num(n, 'polls'));
  if (mode === 'bet' || mode === 'smart') return pctOf(num(n, 'betsOk'), num(n, 'bets'));
  return pctOf(num(n, 'playsOk'), num(n, 'plays'));
}

export function durationText(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

export function dateText(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(now - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (yesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })} ${time}`;
}

// ---------------------------------------------------------------- trend

/** Every k-th point of a series (and the last), for the data table under a long trend. */
export function samplePoints(values: readonly number[], every: number): { i: number; v: number }[] {
  const out: { i: number; v: number }[] = [];
  for (let i = 0; i < values.length; i += every) out.push({ i, v: values[i]! });
  const last = values.length - 1;
  if (last >= 0 && out[out.length - 1]?.i !== last) out.push({ i: last, v: values[last]! });
  return out;
}

/** Clean axis ticks from 0 to max (about `count` of them). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

// ---------------------------------------------------------------- summary helpers

/** Accuracy by up card, as percent-right (the error panel shows the complement). */
export function errorByUp(drills: readonly Drill[]): { col: UpCol; n: number; wrong: number; rate: number | null }[] {
  return UP_COLS.map((col) => {
    let n = 0;
    let wrong = 0;
    for (const d of drills)
      if (d.up === col) {
        n++;
        if (!isRight(d)) wrong++;
      }
    return { col, n, wrong, rate: pctOf(wrong, n) };
  });
}
