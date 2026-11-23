// The table engine: seats (each with one or more hands after splits), the
// dealer, the shoe — and a round as a sequence of small steps, so the UI can
// pace and animate every card. Immutable: each function returns a new Table.
//
//   begin(t, bets)        new round (shuffles first if past the cut card)
//   nextStep(t)           the next automatic step, or null when waiting on
//                         the human (their turn / insurance) or when done
//   apply(t, step)        perform a step
//   act(t, action)        the human's play on the hand whose turn it is
//   insure(t, seat, take) the human's insurance decision
//
// Every mode drives it the same way: apply nextStep() on a timer until it is
// null, then wait for input.

import { hiLo, rankOf, upCol, type Card, type Rng } from './cards';
import { dealerShouldHit, handTotal, isBust, isNatural, isPair } from './hand';
import { MAX_HANDS, type Rules } from './rules';
import { draw, newShoe, pastCut, remaining, type Shoe } from './shoe';
import { bestAction, type Action, type Options } from '@/strategy/tables';

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';

export interface Hand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  /** Came from a split (21 isn't a blackjack; DAS rules apply). */
  split: boolean;
  /** Split aces: one card each, nothing more. */
  aces: boolean;
  surrendered: boolean;
  done: boolean;
  outcome?: Outcome;
  /** Win (+) or loss (−) on this hand, in money. */
  net?: number;
}

export interface Seat {
  hands: Hand[];
  /** Plays itself by basic strategy. */
  auto: boolean;
  /** No bet this round. */
  out: boolean;
  /** Insurance stake: null = not decided (or not offered), 0 = declined. */
  insurance: number | null;
  insuranceNet?: number;
}

export type Phase = 'idle' | 'dealing' | 'insurance' | 'peek' | 'playing' | 'dealer' | 'settle' | 'done';

export type Target = { to: 'seat'; seat: number; hand: number } | { to: 'dealer' };

export type Step =
  | { kind: 'deal'; target: Target }
  | { kind: 'insure'; seat: number; take: boolean }
  | { kind: 'peek' }
  | { kind: 'auto'; seat: number; hand: number; action: Action }
  | { kind: 'reveal' }
  | { kind: 'dealerHit' }
  | { kind: 'settle' };

export interface Turn {
  seat: number;
  hand: number;
}

export interface Table {
  rules: Rules;
  shoe: Shoe;
  /** Seat 0 is first base (the dealer's left), dealt first. */
  seats: Seat[];
  dealer: Card[];
  holeUp: boolean;
  phase: Phase;
  /** Initial-deal targets still to go. */
  queue: Target[];
  turn: Turn | null;
  round: number;
  /** Cards in the discard tray (this shoe). */
  discards: number;
  /** The dealer had blackjack (known after the peek or the reveal). */
  dealerBj: boolean;
}

export function newTable(rules: Rules, seatsAuto: readonly boolean[], rng: Rng = Math.random): Table {
  return {
    rules,
    shoe: newShoe(rules.decks, rules.penetration, rng),
    seats: seatsAuto.map((auto) => ({ hands: [], auto, out: true, insurance: null })),
    dealer: [],
    holeUp: false,
    phase: 'idle',
    queue: [],
    turn: null,
    round: 0,
    discards: 0,
    dealerBj: false,
  };
}

const emptyHand = (bet: number): Hand => ({ cards: [], bet, doubled: false, split: false, aces: false, surrendered: false, done: false });

export function cardsOnTable(t: Table): number {
  return t.dealer.length + t.seats.reduce((n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0), 0);
}

/** The hole card is dealt and still face down. */
export const holeHidden = (t: Table) => t.dealer.length >= 2 && !t.holeUp;

/** The running count of every card seen (the face-down hole card isn't). */
export function seenRc(t: Table): number {
  return t.shoe.rc - (holeHidden(t) ? hiLo(t.dealer[1]!) : 0);
}

/** Cards not yet seen: the shoe plus a face-down hole card. */
export function unseen(t: Table): number {
  return remaining(t.shoe) + (holeHidden(t) ? 1 : 0);
}

/** Cards seen since the shuffle. */
export function seenCount(t: Table): number {
  return t.shoe.pos - (holeHidden(t) ? 1 : 0);
}

/**
 * Start a round. `bets[i]` is seat i's wager (0: sits out). Clears the last
 * round's cards to the discard tray; shuffles first when past the cut card
 * (or when `forceShuffle`).
 */
export function begin(t: Table, bets: readonly number[], rng: Rng = Math.random, forceShuffle = false): Table {
  let shoe = t.shoe;
  let discards = t.discards + cardsOnTable(t);
  if (forceShuffle || pastCut(shoe)) {
    shoe = newShoe(t.rules.decks, t.rules.penetration, rng, shoe.gen + 1);
    discards = 0;
  }
  const seats: Seat[] = t.seats.map((s, i) => {
    const bet = bets[i] ?? 0;
    return { ...s, out: bet <= 0, hands: bet > 0 ? [emptyHand(bet)] : [], insurance: null, insuranceNet: undefined };
  });
  const active = seats.map((s, i) => (s.out ? -1 : i)).filter((i) => i >= 0);
  const queue: Target[] = [];
  for (let k = 0; k < 2; k++) {
    for (const i of active) queue.push({ to: 'seat', seat: i, hand: 0 });
    queue.push({ to: 'dealer' });
  }
  return {
    ...t,
    shoe,
    discards,
    seats,
    dealer: [],
    holeUp: false,
    phase: active.length ? 'dealing' : 'idle',
    queue: active.length ? queue : [],
    turn: null,
    round: t.round + 1,
    dealerBj: false,
  };
}

/** Clear the table (cards to the discard tray) without starting a round. */
export function clear(t: Table): Table {
  return { ...t, discards: t.discards + cardsOnTable(t), seats: t.seats.map((s) => ({ ...s, hands: [], insurance: null, insuranceNet: undefined })), dealer: [], holeUp: false, phase: 'idle', queue: [], turn: null };
}

// ---------------------------------------------------------------- queries

export function hand(t: Table, turn: Turn | null = t.turn): Hand | null {
  if (!turn) return null;
  return t.seats[turn.seat]?.hands[turn.hand] ?? null;
}

export const upCard = (t: Table): Card | null => t.dealer[0] ?? null;

/** What the hand whose turn it is may do. `bankroll`: money the human has off the table (doubling and splitting need a second bet). */
export function options(t: Table, turn: Turn | null = t.turn, bankroll = Infinity): Options {
  const h = hand(t, turn);
  const seat = turn ? t.seats[turn.seat] : undefined;
  const r = t.rules;
  if (!h || !seat || h.done) return { canDouble: false, canSplit: false, canSurrender: false, das: r.das && r.double };
  const two = h.cards.length === 2;
  const afford = bankroll >= h.bet;
  return {
    canDouble: r.double && two && !h.aces && (!h.split || r.das) && afford,
    canSplit: r.split && two && isPair(h.cards) && seat.hands.length < MAX_HANDS && !h.aces && afford,
    canSurrender: r.surrender && two && !h.split && seat.hands.length === 1,
    das: r.das && r.double,
  };
}

export function legal(t: Table, bankroll = Infinity): Action[] {
  if (t.phase !== 'playing' || !t.turn) return [];
  const h = hand(t);
  if (!h || h.done || h.cards.length < 2) return [];
  const o = options(t, t.turn, bankroll);
  const out: Action[] = ['H', 'S'];
  if (o.canDouble) out.push('D');
  if (o.canSplit) out.push('P');
  if (o.canSurrender) out.push('R');
  return out;
}

/** The human is being asked something (their turn, or insurance). */
export function waitingOnHuman(t: Table): 'play' | 'insurance' | null {
  if (t.phase === 'playing' && t.turn) {
    const seat = t.seats[t.turn.seat]!;
    const h = seat.hands[t.turn.hand]!;
    if (!seat.auto && !h.done && h.cards.length >= 2) return 'play';
  }
  if (t.phase === 'insurance' && t.seats.some((s) => !s.out && !s.auto && s.insurance === null)) return 'insurance';
  return null;
}

/** A natural on an unsplit hand. */
export const isBlackjackHand = (h: Hand) => !h.split && isNatural(h.cards);

// ---------------------------------------------------------------- the steps

export function nextStep(t: Table): Step | null {
  switch (t.phase) {
    case 'dealing':
      return t.queue.length ? { kind: 'deal', target: t.queue[0]! } : null;
    case 'insurance': {
      const i = t.seats.findIndex((s) => !s.out && s.auto && s.insurance === null);
      if (i >= 0) return { kind: 'insure', seat: i, take: false };
      if (t.seats.some((s) => !s.out && !s.auto && s.insurance === null)) return null;
      return { kind: 'peek' };
    }
    case 'peek':
      return { kind: 'peek' };
    case 'playing': {
      const turn = t.turn;
      if (!turn) return null;
      const seat = t.seats[turn.seat]!;
      const h = seat.hands[turn.hand]!;
      if (h.cards.length < 2) return { kind: 'deal', target: { to: 'seat', seat: turn.seat, hand: turn.hand } };
      if (seat.auto && !h.done) return { kind: 'auto', seat: turn.seat, hand: turn.hand, action: bestAction(t.rules, h.cards, t.dealer[0]!, options(t, turn)) };
      return null;
    }
    case 'dealer':
      if (!t.holeUp) return { kind: 'reveal' };
      if (anyLive(t) && dealerShouldHit(t.dealer, t.rules.h17)) return { kind: 'dealerHit' };
      return { kind: 'settle' };
    case 'settle':
      return { kind: 'settle' };
    default:
      return null;
  }
}

export function apply(t: Table, step: Step, rng: Rng = Math.random): Table {
  switch (step.kind) {
    case 'deal':
      return dealTo(t, step.target, rng);
    case 'insure':
      return insure(t, step.seat, step.take);
    case 'peek':
      return peek(t);
    case 'auto':
      return play(t, step.action, rng);
    case 'reveal':
      return { ...t, holeUp: true, dealerBj: isNatural(t.dealer) };
    case 'dealerHit': {
      const [c, shoe] = draw(t.shoe, rng);
      return { ...t, shoe, dealer: [...t.dealer, c] };
    }
    case 'settle':
      return settle(t);
  }
}

function withHand(t: Table, seatIdx: number, handIdx: number, f: (h: Hand) => Hand): Table {
  const seats = t.seats.slice();
  const seat = seats[seatIdx]!;
  const hands = seat.hands.slice();
  hands[handIdx] = f(hands[handIdx]!);
  seats[seatIdx] = { ...seat, hands };
  return { ...t, seats };
}

function dealTo(t: Table, target: Target, rng: Rng): Table {
  const [c, shoe] = draw(t.shoe, rng);
  let next: Table = { ...t, shoe };
  if (target.to === 'dealer') next = { ...next, dealer: [...t.dealer, c] };
  else
    next = withHand(next, target.seat, target.hand, (h) => {
      const cards = [...h.cards, c];
      // Split aces take one card; any hand reaching 21 stands.
      const done = (h.aces && cards.length >= 2) || (cards.length >= 2 && handTotal(cards).total >= 21);
      return { ...h, cards, done: h.done || done };
    });

  if (t.phase === 'dealing') {
    next = { ...next, queue: t.queue.slice(1) };
    if (next.queue.length === 0) return afterDeal(next);
    return next;
  }
  if (t.phase === 'playing' && target.to === 'seat') {
    const h = next.seats[target.seat]!.hands[target.hand]!;
    if (h.done) return advance(next);
  }
  return next;
}

/** The initial deal is out: insurance, then the peek, then play. */
function afterDeal(t: Table): Table {
  const up = t.dealer[0]!;
  const ace = rankOf(up) === 'A';
  if (ace && t.rules.insurance) return { ...t, phase: 'insurance' };
  if (ace || upCol(up) === '10') return { ...t, phase: 'peek' };
  return startPlay(t);
}

export function insure(t: Table, seatIdx: number, take: boolean): Table {
  const seats = t.seats.slice();
  const s = seats[seatIdx]!;
  const base = s.hands[0]?.bet ?? 0;
  seats[seatIdx] = { ...s, insurance: take ? base / 2 : 0 };
  return { ...t, seats };
}

function peek(t: Table): Table {
  const bj = isNatural(t.dealer);
  if (bj) {
    // The hand is over: every hand stays as dealt.
    const seats = t.seats.map((s) => ({ ...s, hands: s.hands.map((h) => ({ ...h, done: true })) }));
    return { ...t, seats, holeUp: true, dealerBj: true, phase: 'settle', turn: null };
  }
  return startPlay(t);
}

function startPlay(t: Table): Table {
  // Naturals are paid at once (the dealer has no blackjack): those hands are done.
  const seats = t.seats.map((s) => ({ ...s, hands: s.hands.map((h) => (isBlackjackHand(h) ? { ...h, done: true } : h)) }));
  return advance({ ...t, seats, phase: 'playing', turn: null });
}

/** Move the turn to the next hand that still has to act (or on to the dealer). */
function advance(t: Table): Table {
  const start = t.turn;
  for (let si = start ? start.seat : 0; si < t.seats.length; si++) {
    const seat = t.seats[si]!;
    if (seat.out) continue;
    const from = start && si === start.seat ? start.hand : 0;
    for (let hi = from; hi < seat.hands.length; hi++) {
      if (!seat.hands[hi]!.done) return { ...t, turn: { seat: si, hand: hi } };
    }
  }
  return { ...t, turn: null, phase: 'dealer' };
}

/** The human's play (also used for the auto seats). */
export function act(t: Table, action: Action, rng: Rng = Math.random): Table {
  if (t.phase !== 'playing' || !t.turn) return t;
  return play(t, action, rng);
}

function play(t: Table, action: Action, rng: Rng): Table {
  const turn = t.turn!;
  const h = hand(t, turn)!;
  if (h.done || h.cards.length < 2) return t;
  switch (action) {
    case 'H': {
      return dealTo(t, { to: 'seat', seat: turn.seat, hand: turn.hand }, rng);
    }
    case 'S':
      return advance(withHand(t, turn.seat, turn.hand, (x) => ({ ...x, done: true })));
    case 'D': {
      const doubled = withHand(t, turn.seat, turn.hand, (x) => ({ ...x, bet: x.bet * 2, doubled: true }));
      const [c, shoe] = draw(doubled.shoe, rng);
      return advance(withHand({ ...doubled, shoe }, turn.seat, turn.hand, (x) => ({ ...x, cards: [...x.cards, c], done: true })));
    }
    case 'R':
      return advance(withHand(t, turn.seat, turn.hand, (x) => ({ ...x, surrendered: true, done: true })));
    case 'P': {
      const seats = t.seats.slice();
      const seat = seats[turn.seat]!;
      const aces = rankOf(h.cards[0]!) === 'A';
      const a: Hand = { ...emptyHand(h.bet), cards: [h.cards[0]!], split: true, aces };
      const b: Hand = { ...emptyHand(h.bet), cards: [h.cards[1]!], split: true, aces };
      const hands = seat.hands.slice();
      hands.splice(turn.hand, 1, a, b);
      seats[turn.seat] = { ...seat, hands };
      return { ...t, seats };
    }
  }
}

function anyLive(t: Table): boolean {
  return t.seats.some((s) => !s.out && s.hands.some((h) => !h.surrendered && !isBust(h.cards) && !isBlackjackHand(h)));
}

export function settle(t: Table): Table {
  const dealer = handTotal(t.dealer).total;
  const dealerBj = isNatural(t.dealer);
  const dealerBust = dealer > 21;
  const pay = t.rules.bjPayout;
  const seats = t.seats.map((s) => {
    if (s.out) return s;
    const judge = (h: Hand): [Outcome, number] => {
      const me = handTotal(h.cards).total;
      if (h.surrendered) return ['surrender', -h.bet / 2];
      if (me > 21) return ['bust', -h.bet];
      if (isBlackjackHand(h)) return dealerBj ? ['push', 0] : ['blackjack', h.bet * pay];
      if (dealerBj) return ['lose', -h.bet];
      if (dealerBust || me > dealer) return ['win', h.bet];
      if (me < dealer) return ['lose', -h.bet];
      return ['push', 0];
    };
    const hands = s.hands.map((h): Hand => {
      const [outcome, net] = judge(h);
      return { ...h, outcome, net, done: true };
    });
    const ins = s.insurance ?? 0;
    return { ...s, hands, insuranceNet: ins > 0 ? (dealerBj ? ins * 2 : -ins) : undefined };
  });
  return { ...t, seats, holeUp: true, dealerBj, phase: 'done', turn: null };
}

/** Total win/loss for a seat this round (hands + insurance). */
export function seatNet(s: Seat): number {
  return s.hands.reduce((n, h) => n + (h.net ?? 0), 0) + (s.insuranceNet ?? 0);
}

/** Money a seat has on the table (bets, doubles, splits, insurance). */
export function seatStake(s: Seat): number {
  return s.hands.reduce((n, h) => n + h.bet, 0) + (s.insurance ?? 0);
}

/** Run every automatic step to the end (tests, and skipping animation). */
export function runAuto(t: Table, rng: Rng = Math.random, limit = 500): Table {
  let cur = t;
  for (let i = 0; i < limit; i++) {
    const s = nextStep(cur);
    if (!s) return cur;
    cur = apply(cur, s, rng);
  }
  return cur;
}
