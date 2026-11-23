// Hand arithmetic over plain card arrays.

import { cardValue, rankOf, type Card } from './cards';

export interface Total {
  total: number;
  /** An ace is still counting 11. */
  soft: boolean;
}

export function handTotal(cards: readonly Card[]): Total {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (rankOf(c) === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const handValue = (cards: readonly Card[]) => handTotal(cards).total;
export const isBust = (cards: readonly Card[]) => handValue(cards) > 21;
/** Two cards making 21. (A split hand's 21 isn't a blackjack: check that at the call site.) */
export const isNatural = (cards: readonly Card[]) => cards.length === 2 && handValue(cards) === 21;
/** Two cards of the same value (ten-cards pair with each other). */
export const isPair = (cards: readonly Card[]) => cards.length === 2 && cardValue(cards[0]!) === cardValue(cards[1]!);

/** The dealer draws below 17, and on soft 17 under H17. */
export function dealerShouldHit(cards: readonly Card[], h17: boolean): boolean {
  const { total, soft } = handTotal(cards);
  return total < 17 || (h17 && total === 17 && soft);
}
