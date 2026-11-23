// A colour-coded strategy chart (hard, soft or pairs) for the rules, with an
// optional highlighted cell (the hand in front of you).

import type { CSSProperties } from 'react';
import { UP_COLS, type UpCol } from '@/bj/cards';
import type { Rules } from '@/bj/rules';
import { ACTION_NAME, HARD_ROWS, PAIR_ROWS, SOFT_ROWS, charts, rowLabel, type Action, type HandType } from '@/strategy/tables';

export const ACTIONS: Action[] = ['H', 'S', 'D', 'P', 'R'];

export function ActionPill({ a, long }: { a: Action; long?: boolean }) {
  return <span className={`act act-${a}`}>{long ? ACTION_NAME[a] : a}</span>;
}

export function StrategyGrid({
  rules,
  type,
  highlight,
  compact,
  onCell,
}: {
  rules: Rules;
  type: HandType;
  highlight?: { row: string; col: UpCol } | null;
  compact?: boolean;
  onCell?: (row: string, col: UpCol) => void;
}) {
  const ch = charts(rules);
  const rows: { key: string; actions: Action[] }[] =
    type === 'hard'
      ? HARD_ROWS.map((t) => ({ key: String(t), actions: ch.hard[t]! }))
      : type === 'soft'
        ? SOFT_ROWS.map((t) => ({ key: String(t), actions: ch.soft[t]! }))
        : PAIR_ROWS.map((p) => ({ key: p, actions: ch.pairs[p] }));
  const hr = highlight?.row;
  const hc = highlight ? UP_COLS.indexOf(highlight.col) : -1;
  return (
    <div className={`sgrid${compact ? ' sgrid-compact' : ''}`} role="table" aria-label={`${type} strategy chart`}>
      <div className="sgrid-row sgrid-head" role="row">
        <span className="sgrid-corner" role="columnheader">
          {type === 'pair' ? 'Pair' : type === 'soft' ? 'Soft' : 'Hard'}
        </span>
        {UP_COLS.map((c, i) => (
          <span key={c} className={`sgrid-col${i === hc ? ' is-hl' : ''}`} role="columnheader">
            {c}
          </span>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div key={r.key} className={`sgrid-row${r.key === hr ? ' is-hl' : ''}`} role="row" style={{ '--r': ri } as CSSProperties}>
          <span className="sgrid-label" role="rowheader">
            {type === 'hard' ? r.key : rowLabel(type, r.key)}
          </span>
          {r.actions.map((a, ci) => {
            const hl = r.key === hr && ci === hc;
            return (
              <button
                key={ci}
                type="button"
                role="cell"
                className={`sgrid-cell act-${a}${hl ? ' is-target' : ''}`}
                aria-label={`${rowLabel(type, r.key)} against ${UP_COLS[ci]}: ${ACTION_NAME[a]}`}
                onClick={onCell ? () => onCell(r.key, UP_COLS[ci]!) : undefined}
                tabIndex={onCell ? 0 : -1}
              >
                {a}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ActionLegend() {
  return (
    <div className="legend">
      {ACTIONS.map((a) => (
        <span key={a} className="legend-item">
          <ActionPill a={a} /> {ACTION_NAME[a]}
        </span>
      ))}
    </div>
  );
}
