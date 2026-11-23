// The play buttons (Hit, Stand, Double, Split, Surrender), coloured like the
// strategy charts, with their keys.

import type { CSSProperties } from 'react';
import { ACTION_NAME, type Action } from '@/strategy/tables';

const ORDER: Action[] = ['H', 'S', 'D', 'P', 'R'];

export function ActionBar({
  legal,
  shown = ORDER,
  onAct,
  disabled,
  flash,
}: {
  /** Actions allowed right now. */
  legal: readonly Action[];
  /** Buttons on the bar (the rest of the rules' actions stay hidden). */
  shown?: readonly Action[];
  onAct: (a: Action) => void;
  disabled?: boolean;
  /** Mark a button (feedback): the right answer and/or a wrong pick. */
  flash?: { right?: Action; wrong?: Action } | null;
}) {
  return (
    <div className="action-bar" role="group" aria-label="Your play">
      {ORDER.filter((a) => shown.includes(a)).map((a, i) => (
        <button
          key={a}
          type="button"
          className={`act-btn act-btn-${a}${flash?.right === a ? ' is-right' : ''}${flash?.wrong === a ? ' is-wrong' : ''}`}
          style={{ '--k': i } as CSSProperties}
          disabled={disabled || !legal.includes(a)}
          onClick={() => onAct(a)}
        >
          <span className="act-btn-name">{ACTION_NAME[a]}</span>
          <kbd>{a}</kbd>
        </button>
      ))}
    </div>
  );
}

/** The actions the rules can ever offer. */
export function ruleActions(r: { double: boolean; split: boolean; surrender: boolean }): Action[] {
  const out: Action[] = ['H', 'S'];
  if (r.double) out.push('D');
  if (r.split) out.push('P');
  if (r.surrender) out.push('R');
  return out;
}
