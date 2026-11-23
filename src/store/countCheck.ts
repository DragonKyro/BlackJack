// Grading a count and a bet before a round (Bet and Smart trainers).

import { decksLeft, exactTrueCount, intTrueCount, type TcMethod } from '@/bj/shoe';
import { seenRc, unseen, type Table } from '@/bj/table';
import { betFor, type Spread } from '@/math/betSpread';
import type { CountAsk } from './configStore';

/** Running count, decks left and integer true count of the cards seen. */
export function countOf(t: Table, method: TcMethod) {
  const rc = seenRc(t);
  const left = unseen(t);
  return { rc, decks: decksLeft(left), tc: intTrueCount(rc, left, method) };
}

export interface CountGrade {
  ask: CountAsk;
  guess: number;
  rc: number;
  decks: number;
  /** RC ÷ decks, unrounded. */
  exact: number;
  tc: number;
  /** The number asked for (RC or TC). */
  actual: number;
  ok: boolean;
  close: boolean;
}

export interface BetGrade {
  bet: number;
  right: number;
  ok: boolean;
}

export function gradeCount(t: Table, ask: CountAsk, guess: number, method: TcMethod): CountGrade {
  const rc = seenRc(t);
  const left = unseen(t);
  const tc = intTrueCount(rc, left, method);
  const actual = ask === 'rc' ? rc : tc;
  const diff = Math.abs(guess - actual);
  return { ask, guess, rc, decks: decksLeft(left), exact: exactTrueCount(rc, left), tc, actual, ok: diff === 0, close: diff <= 1 };
}

export function gradeBet(spread: Spread, tc: number, bet: number): BetGrade {
  const right = betFor(spread, tc);
  return { bet, right, ok: bet === right };
}
