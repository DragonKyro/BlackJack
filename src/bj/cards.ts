// Cards: a rank and a suit in two characters, 'AS', 'TH', '9C' ("T" is ten).

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = `${Rank}${Suit}`;

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const TEN_RANKS: readonly Rank[] = ['T', 'J', 'Q', 'K'];

/** The dealer up-card columns of a strategy chart. */
export type UpCol = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'A';
export const UP_COLS: readonly UpCol[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

export function rankOf(c: Card): Rank {
  return c[0] as Rank;
}

export function suitOf(c: Card): Suit {
  return c[1] as Suit;
}

export function card(rank: Rank, suit: Suit): Card {
  return `${rank}${suit}`;
}

/** Blackjack value: 2–10 face, ten-cards 10, ace 11 (hand totals soften it). */
export function rankValue(r: Rank): number {
  if (r === 'A') return 11;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

export function cardValue(c: Card): number {
  return rankValue(rankOf(c));
}

/** Hi-Lo tag: 2–6 = +1, 7–9 = 0, ten-cards and aces = −1. */
export function hiLo(c: Card): number {
  const v = cardValue(c);
  if (v >= 10) return -1;
  if (v <= 6) return 1;
  return 0;
}

/** The chart column for an up card (every ten-card is "10"). */
export function upCol(c: Card): UpCol {
  const v = cardValue(c);
  if (v === 11) return 'A';
  return String(v) as UpCol;
}

const RANK_NAME: Record<Rank, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
  T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};
const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };

export function cardLabel(c: Card): string {
  return `${RANK_NAME[rankOf(c)]} of ${SUIT_NAME[suitOf(c)]}`;
}

/** One deck in rank-major order. */
export function oneDeck(): Card[] {
  const out: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) out.push(card(r, s));
  return out;
}

export type Rng = () => number;

/** Fisher–Yates, in place. */
export function shuffleInPlace<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

export function randomOf<T>(arr: readonly T[], rng: Rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** A small seeded generator (mulberry32) for tests and reproducible shoes. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
