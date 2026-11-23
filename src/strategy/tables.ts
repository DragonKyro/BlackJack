// Basic strategy (multi-deck, US peek, late surrender) for H17 and S17, and
// the Hi-Lo index plays (Illustrious 18 + Fab 4).
//
// Raw chart codes:
//   H  hit · S  stand · P  split
//   D  double, else hit        Ds double, else stand
//   Ph split if DAS, else hit
//   Rh surrender, else hit     Rs surrender, else stand    Rp surrender, else split
// Codes resolve against what the hand can actually do (2 cards? after a
// split? rules?) — see resolve() and bestAction().

import { UP_COLS, cardValue, upCol, type Card, type UpCol } from '@/bj/cards';
import { handTotal, isPair } from '@/bj/hand';
import type { Rules } from '@/bj/rules';

export type Action = 'H' | 'S' | 'D' | 'P' | 'R';
type Raw = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Ph' | 'Rh' | 'Rs' | 'Rp';

export const ACTION_NAME: Record<Action, string> = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };

export type HandType = 'hard' | 'soft' | 'pair';
export type PairRow = 'A' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export const HARD_ROWS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5] as const;
export const SOFT_ROWS = [20, 19, 18, 17, 16, 15, 14, 13] as const;
export const PAIR_ROWS: readonly PairRow[] = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// prettier-ignore
const row = (s: string) => s.trim().split(/\s+/) as Raw[];

// Columns: 2 3 4 5 6 7 8 9 10 A
const HARD_H17: Record<number, Raw[]> = {
  5: row('H  H  H  H  H  H  H  H  H  H'),
  6: row('H  H  H  H  H  H  H  H  H  H'),
  7: row('H  H  H  H  H  H  H  H  H  H'),
  8: row('H  H  H  H  H  H  H  H  H  H'),
  9: row('H  D  D  D  D  H  H  H  H  H'),
  10: row('D  D  D  D  D  D  D  D  H  H'),
  11: row('D  D  D  D  D  D  D  D  D  D'),
  12: row('H  H  S  S  S  H  H  H  H  H'),
  13: row('S  S  S  S  S  H  H  H  H  H'),
  14: row('S  S  S  S  S  H  H  H  H  H'),
  15: row('S  S  S  S  S  H  H  H  Rh Rh'),
  16: row('S  S  S  S  S  H  H  Rh Rh Rh'),
  17: row('S  S  S  S  S  S  S  S  S  Rs'),
  18: row('S  S  S  S  S  S  S  S  S  S'),
  19: row('S  S  S  S  S  S  S  S  S  S'),
  20: row('S  S  S  S  S  S  S  S  S  S'),
};
const HARD_S17: Record<number, Raw[]> = {
  ...HARD_H17,
  11: row('D  D  D  D  D  D  D  D  D  H'),
  15: row('S  S  S  S  S  H  H  H  Rh H'),
  17: row('S  S  S  S  S  S  S  S  S  S'),
};

const SOFT_H17: Record<number, Raw[]> = {
  13: row('H  H  H  D  D  H  H  H  H  H'),
  14: row('H  H  H  D  D  H  H  H  H  H'),
  15: row('H  H  D  D  D  H  H  H  H  H'),
  16: row('H  H  D  D  D  H  H  H  H  H'),
  17: row('H  D  D  D  D  H  H  H  H  H'),
  18: row('Ds Ds Ds Ds Ds S  S  H  H  H'),
  19: row('S  S  S  S  Ds S  S  S  S  S'),
  20: row('S  S  S  S  S  S  S  S  S  S'),
};
const SOFT_S17: Record<number, Raw[]> = {
  ...SOFT_H17,
  18: row('S  Ds Ds Ds Ds S  S  H  H  H'),
  19: row('S  S  S  S  S  S  S  S  S  S'),
};

const PAIRS_H17: Record<PairRow, Raw[]> = {
  A: row('P  P  P  P  P  P  P  P  P  P'),
  '10': row('S  S  S  S  S  S  S  S  S  S'),
  '9': row('P  P  P  P  P  S  P  P  S  S'),
  '8': row('P  P  P  P  P  P  P  P  P  Rp'),
  '7': row('P  P  P  P  P  P  H  H  H  H'),
  '6': row('Ph P  P  P  P  H  H  H  H  H'),
  '5': row('D  D  D  D  D  D  D  D  H  H'),
  '4': row('H  H  H  Ph Ph H  H  H  H  H'),
  '3': row('Ph Ph P  P  P  P  H  H  H  H'),
  '2': row('Ph Ph P  P  P  P  H  H  H  H'),
};
const PAIRS_S17: Record<PairRow, Raw[]> = {
  ...PAIRS_H17,
  '8': row('P  P  P  P  P  P  P  P  P  P'),
};

/** What the hand in front of you may do. */
export interface Options {
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  /** Double after split is allowed (decides the "Ph" cells). */
  das: boolean;
}

/** A fresh two-card hand under these rules. */
export function freshOptions(rules: Rules, cards?: readonly Card[]): Options {
  return {
    canDouble: rules.double,
    canSplit: rules.split && (!cards || isPair(cards)),
    canSurrender: rules.surrender,
    das: rules.das && rules.double,
  };
}

const colIndex = (c: UpCol) => UP_COLS.indexOf(c);

export function pairRow(c: Card): PairRow {
  const v = cardValue(c);
  return v === 11 ? 'A' : (String(v) as PairRow);
}

/** Resolve a non-pair chart code. */
function resolve(raw: Raw, o: Options): Action {
  switch (raw) {
    case 'D':
      return o.canDouble ? 'D' : 'H';
    case 'Ds':
      return o.canDouble ? 'D' : 'S';
    case 'Rh':
      return o.canSurrender ? 'R' : 'H';
    case 'Rs':
      return o.canSurrender ? 'R' : 'S';
    case 'Rp':
      return o.canSurrender ? 'R' : 'P';
    case 'Ph':
      return o.das ? 'P' : 'H';
    default:
      return raw;
  }
}

/** The hard / soft action for a total (no pair splitting considered). */
export function totalAction(h17: boolean, total: number, soft: boolean, col: UpCol, o: Options): Action {
  const i = colIndex(col);
  if (total >= 21) return 'S';
  if (soft) {
    if (total <= 12) return 'H'; // A,A when it can't be split: soft 12 always hits
    return resolve((h17 ? SOFT_H17 : SOFT_S17)[total]![i]!, o);
  }
  if (total < 5) return 'H';
  return resolve((h17 ? HARD_H17 : HARD_S17)[Math.min(total, 20)]![i]!, o);
}

/** Basic strategy for these cards against the up card. */
export function bestAction(rules: Rules, cards: readonly Card[], up: Card | UpCol, o: Options = freshOptions(rules, cards)): Action {
  const col = typeof up === 'string' && up.length <= 2 && !/[SHDC]$/.test(up) ? (up as UpCol) : upCol(up as Card);
  const { total, soft } = handTotal(cards);
  if (o.canSplit && isPair(cards)) {
    const raw = (rules.h17 ? PAIRS_H17 : PAIRS_S17)[pairRow(cards[0]!)][colIndex(col)]!;
    const a = resolve(raw, o);
    if (a === 'P') return 'P';
    if (raw === 'Rp' || raw === 'Ph' || raw === 'P') {
      // Not splitting after all: play the total.
      return totalAction(rules.h17, total, soft, col, o);
    }
    return a;
  }
  return totalAction(rules.h17, total, soft, col, o);
}

/** How a hand is filed in the stats: a pair (when splitting is allowed), soft, or hard — and its chart row. */
export function classify(rules: Rules, cards: readonly Card[]): { type: HandType; row: string } {
  if (rules.split && isPair(cards)) return { type: 'pair', row: pairRow(cards[0]!) };
  const { total, soft } = handTotal(cards);
  if (soft && total >= 13) return { type: 'soft', row: String(total) };
  if (soft) return { type: 'hard', row: '12' };
  return { type: 'hard', row: String(total) };
}

export function rowLabel(type: HandType, rowKey: string): string {
  if (type === 'soft') return `A,${Number(rowKey) - 11}`;
  if (type === 'pair') return rowKey === '10' ? 'T,T' : `${rowKey},${rowKey}`;
  return rowKey;
}

export interface Charts {
  hard: Record<number, Action[]>;
  soft: Record<number, Action[]>;
  pairs: Record<PairRow, Action[]>;
}

/** The three charts, resolved for the rules (a fresh two-card hand). */
export function charts(rules: Rules): Charts {
  const o = freshOptions(rules);
  const hard: Record<number, Action[]> = {};
  const soft: Record<number, Action[]> = {};
  const pairs = {} as Record<PairRow, Action[]>;
  for (const t of HARD_ROWS) hard[t] = UP_COLS.map((c) => totalAction(rules.h17, t, false, c, o));
  for (const t of SOFT_ROWS) soft[t] = UP_COLS.map((c) => totalAction(rules.h17, t, true, c, o));
  for (const p of PAIR_ROWS) {
    const r = p === 'A' ? 'A' : p === '10' ? 'T' : p;
    const cards = [`${r}S`, `${r}H`] as Card[];
    pairs[p] = UP_COLS.map((c) => bestAction(rules, cards, c, { ...o, canSplit: rules.split }));
  }
  return { hard, soft, pairs };
}

/** The chart's action for one cell. */
export function chartAction(rules: Rules, type: HandType, rowKey: string, col: UpCol): Action {
  const ch = charts(rules);
  const i = colIndex(col);
  if (type === 'pair') return ch.pairs[rowKey as PairRow][i]!;
  if (type === 'soft') return ch.soft[Number(rowKey)]?.[i] ?? 'H';
  return ch.hard[Math.max(5, Math.min(20, Number(rowKey)))]![i]!;
}

// ---------------------------------------------------------------- index plays

export interface Deviation {
  id: string;
  set: 'I18' | 'Fab4';
  /** e.g. "16 vs 10", "T,T vs 5", "Insurance". */
  label: string;
  kind: 'insurance' | 'hard' | 'pair';
  total?: number;
  pair?: PairRow;
  up: UpCol;
  index: number;
  /** 'ge': play `action` at TC ≥ index. 'lt': play it at TC < index. */
  dir: 'ge' | 'lt';
  action: Action | 'Ins';
  basic: Action | 'No ins';
}

const dev = (set: Deviation['set'], label: string, kind: Deviation['kind'], key: number | PairRow | null, up: UpCol, index: number, dir: Deviation['dir'], action: Deviation['action'], basic: Deviation['basic']): Deviation => ({
  id: `${set}-${label}`,
  set,
  label,
  kind,
  ...(kind === 'hard' ? { total: key as number } : kind === 'pair' ? { pair: key as PairRow } : {}),
  up,
  index,
  dir,
  action,
  basic,
});

/** The Illustrious 18 (by value) and the Fab 4 surrenders (Hi-Lo, multi-deck). */
export const DEVIATIONS: readonly Deviation[] = [
  dev('I18', 'Insurance', 'insurance', null, 'A', 3, 'ge', 'Ins', 'No ins'),
  dev('I18', '16 vs 10', 'hard', 16, '10', 0, 'ge', 'S', 'H'),
  dev('I18', '15 vs 10', 'hard', 15, '10', 4, 'ge', 'S', 'H'),
  dev('I18', 'T,T vs 5', 'pair', '10', '5', 5, 'ge', 'P', 'S'),
  dev('I18', 'T,T vs 6', 'pair', '10', '6', 4, 'ge', 'P', 'S'),
  dev('I18', '10 vs 10', 'hard', 10, '10', 4, 'ge', 'D', 'H'),
  dev('I18', '12 vs 3', 'hard', 12, '3', 2, 'ge', 'S', 'H'),
  dev('I18', '12 vs 2', 'hard', 12, '2', 3, 'ge', 'S', 'H'),
  dev('I18', '11 vs A', 'hard', 11, 'A', 1, 'ge', 'D', 'H'),
  dev('I18', '9 vs 2', 'hard', 9, '2', 1, 'ge', 'D', 'H'),
  dev('I18', '10 vs A', 'hard', 10, 'A', 4, 'ge', 'D', 'H'),
  dev('I18', '9 vs 7', 'hard', 9, '7', 3, 'ge', 'D', 'H'),
  dev('I18', '16 vs 9', 'hard', 16, '9', 5, 'ge', 'S', 'H'),
  dev('I18', '13 vs 2', 'hard', 13, '2', -1, 'lt', 'H', 'S'),
  dev('I18', '12 vs 4', 'hard', 12, '4', 0, 'lt', 'H', 'S'),
  dev('I18', '12 vs 5', 'hard', 12, '5', -2, 'lt', 'H', 'S'),
  dev('I18', '12 vs 6', 'hard', 12, '6', -1, 'lt', 'H', 'S'),
  dev('I18', '13 vs 3', 'hard', 13, '3', -2, 'lt', 'H', 'S'),
  dev('Fab4', '14 vs 10', 'hard', 14, '10', 3, 'ge', 'R', 'H'),
  dev('Fab4', '15 vs 10', 'hard', 15, '10', 0, 'ge', 'R', 'H'),
  dev('Fab4', '15 vs 9', 'hard', 15, '9', 2, 'ge', 'R', 'H'),
  dev('Fab4', '15 vs A', 'hard', 15, 'A', 1, 'ge', 'R', 'H'),
];

const applies = (d: Deviation, tc: number) => (d.dir === 'ge' ? tc >= d.index : tc < d.index);

/** Take insurance? (Hi-Lo: at TC +3 or more.) */
export function insuranceByCount(tc: number): boolean {
  return tc >= 3;
}

/**
 * The count-adjusted play: basic strategy, overridden by an index play when
 * the true count says so. Returns the action and the deviation used (if any).
 */
export function indexAction(rules: Rules, cards: readonly Card[], up: Card, tc: number, o: Options): { action: Action; deviation: Deviation | null } {
  const col = upCol(up);
  const basic = bestAction(rules, cards, up, o);
  const { total, soft } = handTotal(cards);

  if (basic === 'P' || (o.canSplit && isPair(cards))) {
    const pr = pairRow(cards[0]!);
    for (const d of DEVIATIONS) {
      if (d.kind === 'pair' && d.pair === pr && d.up === col && o.canSplit && applies(d, tc)) return { action: d.action as Action, deviation: d };
    }
    if (basic === 'P') return { action: basic, deviation: null };
  }
  if (soft) return { action: basic, deviation: null };

  // Fab 4: surrender decisions, when surrender is on the table.
  if (o.canSurrender) {
    const f = DEVIATIONS.find((d) => d.set === 'Fab4' && d.total === total && d.up === col);
    if (f) {
      if (applies(f, tc)) return { action: 'R', deviation: f };
      return indexAction(rules, cards, up, tc, { ...o, canSurrender: false });
    }
    if (basic === 'R') return { action: 'R', deviation: null };
  }

  for (const d of DEVIATIONS) {
    if (d.set !== 'I18' || d.kind !== 'hard' || d.total !== total || d.up !== col) continue;
    if (!applies(d, tc)) continue;
    if (d.action === 'D' && !o.canDouble) continue;
    if (d.action === basic) return { action: basic, deviation: null };
    return { action: d.action as Action, deviation: d };
  }
  return { action: basic, deviation: null };
}

/** "Stand at TC ≥ 0" / "Hit below TC −1". */
export function deviationRule(d: Deviation): string {
  const name = d.action === 'Ins' ? 'Take insurance' : ACTION_NAME[d.action];
  const n = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
  return d.dir === 'ge' ? `${name} at TC ${n(d.index)} or more` : `${name} below TC ${n(d.index)}`;
}
