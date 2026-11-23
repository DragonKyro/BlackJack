// Dealing spots for the strategy trainer: two player cards and the dealer's
// up card, by mode. "Smart" weights every chart cell by your record on it, so
// cells you miss (or haven't seen) come up more.

import { RANKS, SUITS, TEN_RANKS, UP_COLS, card, randomOf, type Card, type Rank, type Rng, type UpCol } from '@/bj/cards';
import { isNatural } from '@/bj/hand';
import type { Rules } from '@/bj/rules';
import { PAIR_ROWS, classify, type HandType } from './tables';

export type DealMode = 'random' | 'hard' | 'soft' | 'pairs' | 'smart';

export const DEAL_MODES: { id: DealMode; name: string; hint: string }[] = [
  { id: 'random', name: 'Random', hint: 'Hands as they come off a shoe' },
  { id: 'hard', name: 'Hard', hint: 'Hard totals only' },
  { id: 'soft', name: 'Soft', hint: 'Ace-x hands only' },
  { id: 'pairs', name: 'Pairs', hint: 'Split decisions only' },
  { id: 'smart', name: 'Smart', hint: 'Weighted toward the cells you miss' },
];

export interface Spot {
  cards: [Card, Card];
  up: Card;
  /** The face-down card (for the look of it; never part of the question). */
  hole: Card;
}

/** Per-cell record, keyed `${type}|${row}|${col}`. */
export type CellStats = Map<string, { n: number; wrong: number }>;

export const cellKey = (type: HandType, row: string, col: UpCol) => `${type}|${row}|${col}`;

const randomCard = (rng: Rng): Card => card(randomOf(RANKS, rng), randomOf(SUITS, rng));

function rankForValue(v: number, rng: Rng): Rank {
  if (v === 11 || v === 1) return 'A';
  if (v === 10) return randomOf(TEN_RANKS, rng);
  return String(v) as Rank;
}

const withSuit = (r: Rank, rng: Rng): Card => card(r, randomOf(SUITS, rng));

function upForCol(col: UpCol, rng: Rng): Card {
  return withSuit(col === 'A' ? 'A' : col === '10' ? randomOf(TEN_RANKS, rng) : (col as Rank), rng);
}

/** Cards for one chart cell. */
export function cardsForCell(type: HandType, row: string, rng: Rng = Math.random): [Card, Card] {
  if (type === 'pair') {
    const v = row === 'A' ? 11 : Number(row);
    return [withSuit(rankForValue(v, rng), rng), withSuit(rankForValue(v, rng), rng)];
  }
  if (type === 'soft') return [withSuit('A', rng), withSuit(rankForValue(Number(row) - 11, rng), rng)];
  const total = Number(row);
  const splits: [number, number][] = [];
  for (let a = 2; a <= 10; a++) {
    const b = total - a;
    if (b >= 2 && b <= 10 && a !== b) splits.push([a, b]);
  }
  const [a, b] = splits.length ? randomOf(splits, rng) : [2, Math.max(2, total - 2)];
  return [withSuit(rankForValue(a, rng), rng), withSuit(rankForValue(b, rng), rng)];
}

/** Every cell Smart mode can deal. */
export function smartCells(rules: Rules): { type: HandType; row: string }[] {
  const out: { type: HandType; row: string }[] = [];
  for (let t = 5; t <= 19; t++) out.push({ type: 'hard', row: String(t) });
  for (let t = 13; t <= 20; t++) out.push({ type: 'soft', row: String(t) });
  if (rules.split) for (const p of PAIR_ROWS) out.push({ type: 'pair', row: p });
  return out;
}

/** Smart weight: the smoothed error rate, so unseen cells (½) and missed cells come up most. */
export function cellWeight(rec: { n: number; wrong: number } | undefined): number {
  const n = rec?.n ?? 0;
  const wrong = rec?.wrong ?? 0;
  return 0.5 + (10 * (wrong + 0.5)) / (n + 1);
}

function wanted(mode: DealMode, rules: Rules, cards: [Card, Card]): boolean {
  if (isNatural(cards)) return false;
  const { type } = classify(rules, cards);
  if (mode === 'hard') return type === 'hard';
  if (mode === 'soft') return type === 'soft';
  if (mode === 'pairs') return type === 'pair';
  return true;
}

export function dealSpot(mode: DealMode, rules: Rules, cells: CellStats, rng: Rng = Math.random): Spot {
  const hole = randomCard(rng);
  if (mode === 'smart') {
    const all = smartCells(rules).flatMap((c) => UP_COLS.map((col) => ({ ...c, col })));
    const weights = all.map((c) => cellWeight(cells.get(cellKey(c.type, c.row, c.col))));
    let x = rng() * weights.reduce((a, b) => a + b, 0);
    let pick = all[all.length - 1]!;
    for (let i = 0; i < all.length; i++) {
      x -= weights[i]!;
      if (x <= 0) {
        pick = all[i]!;
        break;
      }
    }
    return { cards: cardsForCell(pick.type, pick.row, rng), up: upForCol(pick.col, rng), hole };
  }
  if (mode === 'pairs' && !rules.split) mode = 'random';
  // Natural frequencies: draw random cards until the hand fits the mode.
  for (let i = 0; i < 2000; i++) {
    const cards: [Card, Card] = [randomCard(rng), randomCard(rng)];
    if (wanted(mode, rules, cards)) return { cards, up: randomCard(rng), hole };
  }
  return { cards: ['9S', '7H'], up: randomCard(rng), hole };
}
