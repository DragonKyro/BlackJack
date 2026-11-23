// Seats along the table's arc (first base on the right, as the dealer sees
// it from across the table), or a lone seat at the bottom centre.

import type { CSSProperties } from 'react';
import type { Table } from '@/bj/table';
import { SeatView } from './Hands';

/** Arc positions (% of the felt) for n seats, seat 0 at first base (right). */
export function arcPositions(n: number): { x: number; y: number }[] {
  if (n === 1) return [{ x: 50, y: 98 }];
  return Array.from({ length: n }, (_, i) => {
    const th = ((22 + (136 * i) / (n - 1)) * Math.PI) / 180;
    return { x: 50 + 41 * Math.cos(th), y: 62 + 36 * Math.sin(th) };
  });
}

export function Seats({
  table,
  you,
  names,
  sweep,
  showResults,
  units,
  pendingBet,
  flightMs,
  bare,
}: {
  table: Table;
  /** Your seat (−1: none). */
  you: number;
  names?: (i: number) => string | undefined;
  sweep?: boolean;
  showResults: boolean;
  units?: boolean;
  /** Your bet shown in the circle while betting. */
  pendingBet?: number;
  flightMs?: number;
  bare?: boolean;
}) {
  const n = table.seats.length;
  const arc = n > 1;
  const pos = arcPositions(n);
  return (
    <div className={`seats${arc ? ' seats-arc' : ''}`} style={{ '--n': n } as CSSProperties}>
      {table.seats.map((s, i) => (
        <SeatView
          key={i}
          seat={s}
          you={i === you}
          name={names?.(i)}
          activeHand={table.turn?.seat === i ? table.turn.hand : -1}
          sweep={sweep}
          showResults={showResults}
          units={units}
          pendingBet={i === you ? pendingBet : undefined}
          flightMs={flightMs}
          layout={n >= 5 ? 'compact' : 'full'}
          bare={bare}
          style={arc ? ({ '--x': `${pos[i]!.x}%`, '--y': `${pos[i]!.y}%` } as CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}

/** Card width for a table of n seats. */
export function seatCardWidth(n: number): string {
  if (n <= 1) return 'var(--cw)';
  return `clamp(30px, min(calc(88vw / ${n * 2.05}), calc(1100px / ${n * 2.4}), 8.4dvh), 78px)`;
}
