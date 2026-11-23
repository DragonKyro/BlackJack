// The error-rate heatmap over the strategy grid (rows × dealer up cards).
// Semantic heat with a scale legend: no errors recede toward the surface,
// misses run warning → serious → critical. Every cell prints its rate (so
// colour never carries it alone) and is a focusable button; hover / focus /
// tap selects it for the detail line.

import type { CSSProperties } from 'react';
import { UP_COLS, type UpCol } from '@/bj/cards';
import type { Cell } from '@/math/analytics';
import { HEAT_STOPS, heatColor } from '@/math/statsView';
import { rowLabel, type HandType } from '@/strategy/tables';

export function Heatmap({
  type,
  rows,
  cells,
  selected,
  onSelect,
}: {
  type: HandType;
  rows: readonly string[];
  cells: Cell[][];
  selected: { r: number; c: number } | null;
  onSelect: (sel: { r: number; c: number } | null) => void;
}) {
  return (
    <div className="hm" role="grid" aria-label={`${type} error rates`}>
      <div className="hm-row hm-head" role="row">
        <span className="hm-corner" role="columnheader">
          {type === 'pair' ? 'Pair' : type === 'soft' ? 'Soft' : 'Hard'}
        </span>
        {UP_COLS.map((c, i) => (
          <span key={c} className={`hm-col${selected?.c === i ? ' is-hl' : ''}`} role="columnheader">
            {c}
          </span>
        ))}
      </div>
      {rows.map((row, r) => (
        <div key={row} className="hm-row" role="row" style={{ '--r': r } as CSSProperties}>
          <span className={`hm-label${selected?.r === r ? ' is-hl' : ''}`} role="rowheader">
            {rowLabel(type, row)}
          </span>
          {cells[r]!.map((cell, c) => {
            const rate = cell.n > 0 ? (cell.wrong / cell.n) * 100 : null;
            const col = heatColor(rate);
            const sel = selected?.r === r && selected.c === c;
            return (
              <button
                key={c}
                type="button"
                role="gridcell"
                className={`hm-cell${col ? '' : ' is-empty'}${sel ? ' is-sel' : ''}`}
                style={{ ...(col ? { background: col.bg, color: col.fg } : {}), '--d': r * 10 + c } as CSSProperties}
                aria-label={`${rowLabel(type, row)} against ${UP_COLS[c]}: ${rate === null ? 'no data' : `${cell.wrong} of ${cell.n} wrong`}`}
                aria-pressed={sel}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onSelect({ r, c })}
                onFocus={(e) => e.currentTarget.matches(':focus-visible') && onSelect({ r, c })}
                onClick={() => onSelect({ r, c })}
              >
                {rate === null ? '·' : Math.round(rate)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The colour scale: a gradient over the stops, their ticks, and the no-data swatch. */
export function HeatLegend() {
  const last = HEAT_STOPS[HEAT_STOPS.length - 1]![0];
  const grad = HEAT_STOPS.map(([r, c]) => `${c} ${(r / last) * 100}%`).join(', ');
  return (
    <div className="hm-legend">
      <span className="hm-legend-title">Error rate</span>
      <span className="hm-legend-scale">
        <span className="hm-legend-bar" style={{ background: `linear-gradient(90deg, ${grad})` }} />
        <span className="hm-legend-ticks">
          {HEAT_STOPS.map(([r]) => (
            <span key={r} style={{ left: `${(r / last) * 100}%` }}>
              {r}
              {r === last ? '%+' : ''}
            </span>
          ))}
        </span>
      </span>
      <span className="hm-legend-none">
        <i /> No data
      </span>
    </div>
  );
}

export type { UpCol };
