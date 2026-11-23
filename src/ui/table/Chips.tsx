// Chips on screen: a stack (an amount broken into denominations) and the
// rack you bet from.

import type { CSSProperties } from 'react';
import { DENOMS, chipSrc, chipsFor, formatMoney, type Denom } from '../chips/chipArt';

export function ChipImg({ d }: { d: Denom }) {
  return <img className="chip-img" src={chipSrc(d)} alt="" draggable={false} />;
}

export function ChipStack({ amount, max = 10, label = true, units }: { amount: number; max?: number; label?: boolean; units?: boolean }) {
  const chips = chipsFor(amount, max);
  const text = units ? `${amount}u` : formatMoney(amount);
  return (
    <span className="chip-stack" aria-label={text} style={{ '--n': chips.length } as CSSProperties}>
      {chips.map((d, i) => (
        <span key={`${i}-${d}`} className="stack-chip" style={{ '--i': i } as CSSProperties}>
          <ChipImg d={d} />
        </span>
      ))}
      {label && <span className="stack-label">{text}</span>}
    </span>
  );
}

/** The chips you can bet with (only those you can afford are live). */
export function ChipRack({ bankroll, onChip, disabled }: { bankroll: number; onChip: (d: Denom) => void; disabled?: boolean }) {
  return (
    <div className="chip-rack" role="group" aria-label="Add chips to your bet">
      {DENOMS.map((d, i) => (
        <button key={d} type="button" className="rack-chip" style={{ '--k': i } as CSSProperties} disabled={disabled || d > bankroll} onClick={() => onChip(d)} aria-label={`Add ${formatMoney(d)}`}>
          <ChipImg d={d} />
        </button>
      ))}
    </div>
  );
}
