// Hands on the felt: the dealer's, and a seat's (one or more hands after a
// split) with its betting circle, chips, total badges and result.

import { memo, useMemo, type CSSProperties } from 'react';
import type { Card } from '@/bj/cards';
import { handTotal, isNatural } from '@/bj/hand';
import { isBlackjackHand, type Hand, type Outcome, type Seat } from '@/bj/table';
import { TableCard } from '../cards/CardView';
import { formatMoney } from '../chips/chipArt';
import { ChipStack } from './Chips';

export function TotalBadge({ cards, natural = true, hideSoft = false, className }: { cards: readonly Card[]; natural?: boolean; hideSoft?: boolean; className?: string }) {
  if (cards.length === 0) return null;
  const { total, soft } = handTotal(cards);
  let text: string;
  let kind = '';
  if (total > 21) {
    text = `Bust · ${total}`;
    kind = ' is-bust';
  } else if (natural && isNatural(cards)) {
    text = 'Blackjack';
    kind = ' is-bj';
  } else if (soft && total < 21 && !hideSoft) text = `${total - 10} / ${total}`;
  else text = String(total);
  return (
    <span key={text} className={`total${kind}${className ? ` ${className}` : ''}`}>
      {text}
    </span>
  );
}

/** Cards fanned left to right with a slight rise, each dealt in from the shoe. (A row glides when it moves: see Felt.) */
export const CardRow = memo(function CardRow({ cards, hideFrom, sweep, layout = 'full', flightMs }: { cards: readonly Card[]; hideFrom?: number; sweep?: boolean; layout?: 'full' | 'compact'; flightMs?: number }) {
  return (
    <span className="cards" data-flip="" style={{ '--n': cards.length } as CSSProperties}>
      {cards.map((c, i) => (
        <TableCard key={`${i}-${c}`} card={c} down={hideFrom !== undefined && i >= hideFrom} sweep={sweep} layout={layout} style={cardStyle(i)} className="hand-card" flightMs={flightMs} />
      ))}
    </span>
  );
});

const styles: CSSProperties[] = [];
/** Stable style objects per position (so memoised cards don't re-render). */
function cardStyle(i: number): CSSProperties {
  return (styles[i] ??= { '--i': i } as CSSProperties);
}

export const DealerArea = memo(function DealerArea({ cards, holeUp, sweep, peeking, label = 'Dealer', flightMs, totals = true }: { cards: readonly Card[]; holeUp: boolean; sweep?: boolean; peeking?: boolean; label?: string; flightMs?: number; totals?: boolean }) {
  const shown = holeUp ? cards : cards.slice(0, 1);
  return (
    <div className={`dealer-area${peeking ? ' is-peeking' : ''}`}>
      <span className="seat-tag">{label}</span>
      <div className="dealer-hand">
        <CardRow cards={cards} hideFrom={holeUp ? undefined : 1} sweep={sweep} flightMs={flightMs} />
      </div>
      <span className="total-slot">{totals && cards.length > 0 && !sweep && <TotalBadge cards={shown} natural={holeUp} />}</span>
    </div>
  );
});

const OUTCOME_TEXT: Record<Outcome, string> = { blackjack: 'Blackjack!', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', surrender: 'Surrender' };

export function ResultBadge({ outcome, net, units }: { outcome: Outcome; net: number; units?: boolean }) {
  const amount = units ? `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)}u` : formatMoney(net, true);
  return (
    <span className={`result-badge rb-${outcome}`}>
      {OUTCOME_TEXT[outcome]}
      {net !== 0 && <b>{amount}</b>}
    </span>
  );
}

export const HandView = memo(function HandView({ hand, active, sweep, showResult, units, flightMs, layout, totals = true }: { hand: Hand; active: boolean; sweep?: boolean; showResult: boolean; units?: boolean; flightMs?: number; layout?: 'full' | 'compact'; totals?: boolean }) {
  const bj = isBlackjackHand(hand);
  return (
    <div className={`hand${active ? ' is-active' : ''}${hand.outcome ? ` out-${hand.outcome}` : ''}${hand.doubled ? ' is-doubled' : ''}`}>
      <span className="result-slot">{showResult && hand.outcome && !sweep && <ResultBadge outcome={hand.outcome} net={hand.net ?? 0} units={units} />}</span>
      <CardRow cards={hand.cards} sweep={sweep} flightMs={flightMs} layout={layout} />
      {totals && <span className="total-slot">{hand.cards.length > 0 && !sweep && <TotalBadge cards={hand.cards} natural={bj} />}</span>}
    </div>
  );
});

export const SeatView = memo(function SeatView({
  seat,
  name,
  you,
  activeHand,
  sweep,
  showResults,
  units,
  x,
  y,
  flightMs,
  pendingBet,
  layout,
  bare,
}: {
  seat: Seat;
  name?: string;
  you?: boolean;
  /** Index of the hand whose turn it is (in this seat), or -1. */
  activeHand: number;
  sweep?: boolean;
  showResults: boolean;
  units?: boolean;
  /** Position on the arc (% of the felt); none for a lone seat. */
  x?: number;
  y?: number;
  flightMs?: number;
  /** Chips shown in the circle before the deal (betting). */
  pendingBet?: number;
  layout?: 'full' | 'compact';
  /** No betting circle, no totals (the counting trainer: cards only). */
  bare?: boolean;
}) {
  const stake = seat.hands.length ? seat.hands[0]!.bet / (seat.hands[0]!.doubled ? 2 : 1) : pendingBet ?? 0;
  const outcomes = useMemo(() => seat.hands.map((h) => h.outcome), [seat.hands]);
  const won = outcomes.some((o) => o === 'win' || o === 'blackjack');
  const lost = outcomes.length > 0 && outcomes.every((o) => o === 'lose' || o === 'bust' || o === 'surrender');
  return (
    <div className={`seat${you ? ' is-you' : ''}${activeHand >= 0 ? ' is-turn' : ''}${seat.out && !pendingBet ? ' is-out' : ''}`} style={x === undefined ? undefined : ({ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties)}>
      <div className="seat-hands">
        {seat.hands.map((h, i) => (
          <HandView key={i} hand={h} active={i === activeHand} sweep={sweep} showResult={showResults} units={units} flightMs={flightMs} layout={layout} totals={!bare} />
        ))}
      </div>
      {!bare && <div className={`bet-circle${showResults && won ? ' is-won' : ''}${showResults && lost ? ' is-lost' : ''}`}>
        {stake > 0 && <ChipStack amount={stake} units={units} />}
        {seat.insurance ? (
          <span className="ins-chip">
            <ChipStack amount={seat.insurance} max={3} units={units} />
          </span>
        ) : null}
      </div>}
      {name && <span className="seat-name">{name}</span>}
    </div>
  );
});
