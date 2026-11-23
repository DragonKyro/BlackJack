// The shoe: a shuffled multi-deck stack, a position, the cut card and the
// running count of every card drawn. Immutable — drawing returns a new shoe
// that shares the card array (only `pos` and `rc` change).

import { hiLo, oneDeck, shuffleInPlace, type Card, type Rng } from './cards';

export interface Shoe {
  readonly cards: readonly Card[];
  readonly pos: number;
  /** Hi-Lo running count of cards drawn so far. */
  readonly rc: number;
  readonly decks: number;
  /** Shuffle once `pos` reaches this. */
  readonly cut: number;
  /** Increments with each shuffle (lets the UI notice one). */
  readonly gen: number;
}

export function newShoe(decks: number, penetration: number, rng: Rng = Math.random, gen = 0): Shoe {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) cards.push(...oneDeck());
  shuffleInPlace(cards, rng);
  const cut = Math.max(1, Math.min(cards.length - 1, Math.round(cards.length * penetration)));
  return { cards, pos: 0, rc: 0, decks, cut, gen };
}

/** A shoe holding exactly these cards on top (tests). */
export function stackedShoe(top: readonly Card[], decks = 6, penetration = 0.75): Shoe {
  const rest = newShoe(decks, penetration).cards.slice();
  for (const c of top) {
    const i = rest.indexOf(c);
    if (i >= 0) rest.splice(i, 1);
  }
  const cards = [...top, ...rest];
  return { cards, pos: 0, rc: 0, decks, cut: Math.round(cards.length * penetration), gen: 0 };
}

export function draw(shoe: Shoe, rng: Rng = Math.random): [Card, Shoe] {
  let s = shoe;
  // Out of cards mid-round (a deep cut, a full table): a fresh shoe.
  if (s.pos >= s.cards.length) s = newShoe(s.decks, s.cut / s.cards.length, rng, s.gen + 1);
  const c = s.cards[s.pos]!;
  return [c, { ...s, pos: s.pos + 1, rc: s.rc + hiLo(c) }];
}

export const remaining = (s: Shoe) => s.cards.length - s.pos;
export const totalCards = (s: Shoe) => s.cards.length;
export const pastCut = (s: Shoe) => s.pos >= s.cut;

export type TcMethod = 'round' | 'floor' | 'truncate';

/** Decks left, estimated to the nearest half deck (as a counter eyeballs the discard tray), at least ½. */
export function decksLeft(unseen: number): number {
  return Math.max(0.5, Math.round((unseen / 52) * 2) / 2);
}

/** The true count as a real number. */
export function exactTrueCount(rc: number, unseen: number): number {
  return rc / decksLeft(unseen);
}

/** The integer true count a counter bets from. */
export function intTrueCount(rc: number, unseen: number, method: TcMethod): number {
  return toIntTc(exactTrueCount(rc, unseen), method);
}

export function toIntTc(tc: number, method: TcMethod): number {
  // Guard float noise, e.g. 7 / 3.5 = 1.9999999.
  const x = Math.round(tc * 1e9) / 1e9;
  if (method === 'floor') return Math.floor(x);
  if (method === 'truncate') return Math.trunc(x) + 0; // + 0: no −0
  return Math.sign(x) * Math.round(Math.abs(x)) + 0; // half away from zero
}
