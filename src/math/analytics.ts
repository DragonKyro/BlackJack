// Training analytics over the decision log: summary numbers, the error-rate
// heatmap over the strategy grid, the rolling-accuracy trend, error rate by
// up card, and the spots you miss most. (The pandas / matplotlib / Plotly
// pipeline of the desktop app, as plain functions feeding SVG charts.)

import { UP_COLS, type UpCol } from '@/bj/cards';
import type { Action, HandType } from '@/strategy/tables';
import { HARD_ROWS, PAIR_ROWS, SOFT_ROWS } from '@/strategy/tables';
import type { CellStats } from '@/strategy/deal';

export type DrillMode = 'strategy' | 'smart' | 'play';

/** One strategy decision. */
export interface Drill {
  id: string;
  ts: number;
  mode: DrillMode;
  type: HandType;
  /** Chart row: hard/soft total ("16"), or pair rank ("A", "10", "8"). */
  row: string;
  up: UpCol;
  your: Action;
  /** The right play (basic strategy, or the index play when counting). */
  ans: Action;
  /** True count at the time (Smart trainer with index plays). */
  tc?: number;
}

export const isRight = (d: Drill) => d.your === d.ans;

export interface Summary {
  total: number;
  correct: number;
  pct: number;
  byType: Record<HandType, { total: number; correct: number }>;
  byMode: Record<DrillMode, { total: number; correct: number }>;
  last10: number;
  last50: number;
  streak: number;
  best: number;
}

const pct = (c: number, n: number) => (n > 0 ? (c / n) * 100 : 0);

export function summarize(drills: readonly Drill[]): Summary {
  const byType = { hard: { total: 0, correct: 0 }, soft: { total: 0, correct: 0 }, pair: { total: 0, correct: 0 } };
  const byMode = { strategy: { total: 0, correct: 0 }, smart: { total: 0, correct: 0 }, play: { total: 0, correct: 0 } };
  let correct = 0;
  let run = 0;
  let best = 0;
  for (const d of drills) {
    const ok = isRight(d);
    byType[d.type].total++;
    byMode[d.mode].total++;
    if (ok) {
      correct++;
      byType[d.type].correct++;
      byMode[d.mode].correct++;
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  const tail = (k: number) => {
    const s = drills.slice(-k);
    return pct(s.filter(isRight).length, s.length);
  };
  return { total: drills.length, correct, pct: pct(correct, drills.length), byType, byMode, last10: tail(10), last50: tail(50), streak: run, best };
}

export function rowsFor(type: HandType): readonly string[] {
  if (type === 'hard') return HARD_ROWS.map(String);
  if (type === 'soft') return SOFT_ROWS.map(String);
  return PAIR_ROWS;
}

export interface Cell {
  n: number;
  wrong: number;
  /** Your wrong answers here, most common first. */
  yours: [Action, number][];
}

/** Error counts per chart cell, rows × up-card columns. */
export function heatmap(drills: readonly Drill[], type: HandType): { rows: readonly string[]; cells: Cell[][] } {
  const rows = rowsFor(type);
  const index = new Map(rows.map((r, i) => [r, i]));
  const cells: Cell[][] = rows.map(() => UP_COLS.map(() => ({ n: 0, wrong: 0, yours: [] })));
  const wrongs: Map<string, Map<Action, number>> = new Map();
  for (const d of drills) {
    if (d.type !== type) continue;
    const r = index.get(d.row);
    const c = UP_COLS.indexOf(d.up);
    if (r === undefined || c < 0) continue;
    const cell = cells[r]![c]!;
    cell.n++;
    if (!isRight(d)) {
      cell.wrong++;
      const k = `${r}|${c}`;
      const m = wrongs.get(k) ?? new Map<Action, number>();
      m.set(d.your, (m.get(d.your) ?? 0) + 1);
      wrongs.set(k, m);
    }
  }
  for (const [k, m] of wrongs) {
    const [r, c] = k.split('|').map(Number) as [number, number];
    cells[r]![c]!.yours = [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  return { rows, cells };
}

/** Rolling accuracy (%) over a window, one point per decision from the window-th on. */
export function rolling(drills: readonly Drill[], window = 20): number[] {
  const out: number[] = [];
  let ok = 0;
  for (let i = 0; i < drills.length; i++) {
    if (isRight(drills[i]!)) ok++;
    if (i >= window && isRight(drills[i - window]!)) ok--;
    if (i >= window - 1) out.push((ok / window) * 100);
  }
  return out;
}

/** Error rate (%) and count by dealer up card. */
export function byUpCard(drills: readonly Drill[]): { col: UpCol; n: number; wrong: number; rate: number }[] {
  return UP_COLS.map((col) => {
    const sub = drills.filter((d) => d.up === col);
    const wrong = sub.filter((d) => !isRight(d)).length;
    return { col, n: sub.length, wrong, rate: pct(wrong, sub.length) };
  });
}

export interface Leak {
  type: HandType;
  row: string;
  up: UpCol;
  n: number;
  wrong: number;
  ans: Action;
  your: Action;
}

/** The cells you miss most (by errors, then error rate). */
export function leaks(drills: readonly Drill[], limit = 8): Leak[] {
  const m = new Map<string, Leak & { yours: Map<Action, number> }>();
  for (const d of drills) {
    const k = `${d.type}|${d.row}|${d.up}`;
    let e = m.get(k);
    if (!e) {
      e = { type: d.type, row: d.row, up: d.up, n: 0, wrong: 0, ans: d.ans, your: d.your, yours: new Map() };
      m.set(k, e);
    }
    e.n++;
    e.ans = d.ans;
    if (!isRight(d)) {
      e.wrong++;
      e.yours.set(d.your, (e.yours.get(d.your) ?? 0) + 1);
    }
  }
  return [...m.values()]
    .filter((e) => e.wrong > 0)
    .map((e) => ({ ...e, your: [...e.yours.entries()].sort((a, b) => b[1] - a[1])[0]![0] }))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.n - a.wrong / a.n)
    .slice(0, limit)
    .map(({ type, row, up, n, wrong, ans, your }) => ({ type, row, up, n, wrong, ans, your }));
}

/** Per-cell records for Smart dealing. */
export function cellStats(drills: readonly Drill[]): CellStats {
  const m: CellStats = new Map();
  for (const d of drills) {
    const k = `${d.type}|${d.row}|${d.up}`;
    const e = m.get(k) ?? { n: 0, wrong: 0 };
    e.n++;
    if (!isRight(d)) e.wrong++;
    m.set(k, e);
  }
  return m;
}
