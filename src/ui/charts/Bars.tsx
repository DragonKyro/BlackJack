// Bar charts for the Stats page: a horizontal bar list (a few named
// categories, value at the tip) and a column chart (a value per up card or
// per session). One series each, so one colour and no legend box — the panel
// title names it. Thin marks, 4px rounded data-ends square at the baseline,
// solid hairline grid, a per-mark hover/focus tooltip, and a table view.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { SERIES_1, niceTicks } from '@/math/statsView';
import { useWidth } from './useSize';

export interface BarItem {
  key: string;
  label: string;
  /** Full name for the tooltip and table (defaults to the axis label). */
  name?: string;
  /** null: no data (no bar drawn). */
  value: number | null;
  /** Secondary line for the tooltip / table, e.g. "n = 412". */
  sub?: string;
}

const fmt = (v: number, unit: string) => `${Math.round(v)}${unit}`;

/** A rounded-end bar from (x0, y) to the right, `len` long, `t` thick (square at the baseline). */
function hbarPath(x0: number, y: number, len: number, t: number): string {
  const r = Math.min(4, len, t / 2);
  return `M${x0} ${y}H${x0 + len - r}A${r} ${r} 0 0 1 ${x0 + len} ${y + r}V${y + t - r}A${r} ${r} 0 0 1 ${x0 + len - r} ${y + t}H${x0}Z`;
}

/** A rounded-top column from the baseline `yb` up `h`, `w` wide. */
function colPath(x: number, yb: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x} ${yb}V${yb - h + r}A${r} ${r} 0 0 1 ${x + r} ${yb - h}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${yb - h + r}V${yb}Z`;
}

export function BarList({ items, max = 100, unit = '%', label }: { items: BarItem[]; max?: number; unit?: string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = 64;
  const valueW = 44;
  const track = Math.max(40, width - labelW - valueW);
  const rowH = 34;
  const t = 14;
  const h = items.length * rowH;
  return (
    <div className="sv" ref={ref}>
      <svg className="sv-svg" width={width} height={h} role="img" aria-label={label}>
        {items.map((it, i) => {
          const y = i * rowH + (rowH - t) / 2;
          const len = it.value === null ? 0 : (Math.max(0, Math.min(max, it.value)) / max) * track;
          return (
            <g
              key={it.key}
              className={`sv-mark${hover === i ? ' is-hover' : ''}`}
              tabIndex={0}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${it.name ?? it.label}: ${it.value === null ? 'no data' : fmt(it.value, unit)}${it.sub ? `, ${it.sub}` : ''}`}
            >
              <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" />
              <text className="sv-label" x={labelW - 10} y={y + t / 2} textAnchor="end" dominantBaseline="central">
                {it.label}
              </text>
              <rect className="sv-track" x={labelW} y={y} width={track} height={t} rx={4} />
              {len > 0 && <path className="sv-hbar" d={hbarPath(labelW, y, len, t)} fill={SERIES_1} style={{ '--i': i } as CSSProperties} />}
              <text className="sv-value" x={labelW + len + 8} y={y + t / 2} dominantBaseline="central">
                {it.value === null ? '—' : fmt(it.value, unit)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && items[hover]?.sub && (
        <div className="sv-tip" style={{ left: labelW + 8, top: hover * rowH - 30 }}>
          <b>{items[hover]!.value === null ? 'No data' : fmt(items[hover]!.value!, unit)}</b>
          <span>
            {items[hover]!.label} · {items[hover]!.sub}
          </span>
        </div>
      )}
      <TableView caption={label} rows={items.map((it) => [it.label, it.value === null ? '—' : fmt(it.value, unit), it.sub ?? ''])} head={['', 'Value', '']} />
    </div>
  );
}

export function ColumnChart({
  items,
  max = 100,
  unit = '%',
  height = 170,
  label,
  highlight = 'max',
  xTitle,
}: {
  items: BarItem[];
  max?: number;
  unit?: string;
  height?: number;
  label: string;
  /** Which column gets a direct value label (the rest: axis, tooltip, table). */
  highlight?: 'max' | 'last' | 'none';
  xTitle?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const left = 34;
  const top = 18;
  const bottom = 24;
  const plotW = Math.max(60, width - left - 4);
  const plotH = height - top - bottom;
  const yb = top + plotH;
  const band = plotW / Math.max(1, items.length);
  const colW = Math.max(4, Math.min(24, band * 0.62));
  const ticks = niceTicks(max, 4);
  const stepV = ticks[1] ?? max;
  if (ticks[ticks.length - 1]! < max - 1e-9) ticks.push(Math.round((ticks[ticks.length - 1]! + stepV) * 1000) / 1000);
  const scaleMax = ticks[ticks.length - 1]!;
  const values = items.map((it) => it.value);
  let hl = -1;
  if (highlight === 'max') {
    let best = -Infinity;
    values.forEach((v, i) => {
      if (v !== null && v > best) {
        best = v;
        hl = i;
      }
    });
  } else if (highlight === 'last') {
    for (let i = values.length - 1; i >= 0; i--)
      if (values[i] !== null) {
        hl = i;
        break;
      }
  }
  const tipX = hover === null ? 0 : left + band * hover + band / 2;
  const hv = hover === null ? null : items[hover]?.value ?? null;
  const tipY = hv === null ? yb : yb - (Math.max(0, Math.min(scaleMax, hv)) / scaleMax) * plotH - 8;
  return (
    <div className="sv" ref={ref}>
      <svg className="sv-svg" width={width} height={height} role="img" aria-label={label}>
        {ticks.map((tv) => {
          const y = yb - (tv / scaleMax) * plotH;
          return (
            <g key={tv}>
              <line className={tv === 0 ? 'sv-base' : 'sv-grid'} x1={left} x2={left + plotW} y1={y} y2={y} />
              <text className="sv-tick" x={left - 6} y={y} textAnchor="end" dominantBaseline="central">
                {tv}
                {unit === '%' && tv === scaleMax ? '%' : ''}
              </text>
            </g>
          );
        })}
        {items.map((it, i) => {
          const x = left + band * i + (band - colW) / 2;
          const h = it.value === null ? 0 : (Math.max(0, Math.min(scaleMax, it.value)) / scaleMax) * plotH;
          return (
            <g
              key={it.key}
              className={`sv-mark${hover === i ? ' is-hover' : ''}`}
              tabIndex={0}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${it.name ?? it.label}: ${it.value === null ? 'no data' : fmt(it.value, unit)}${it.sub ? `, ${it.sub}` : ''}`}
            >
              <rect x={left + band * i} y={top} width={band} height={plotH + bottom} fill="transparent" />
              {h > 0 && <path className="sv-col" d={colPath(x, yb, colW, h)} fill={SERIES_1} style={{ '--i': i } as CSSProperties} />}
              {i === hl && it.value !== null && (
                <text className="sv-value" x={x + colW / 2} y={yb - h - 6} textAnchor="middle">
                  {fmt(it.value, unit)}
                </text>
              )}
              <text className={`sv-tick sv-x${it.value === null ? ' is-empty' : ''}`} x={left + band * i + band / 2} y={yb + 15} textAnchor="middle">
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
      {xTitle && <div className="sv-xtitle">{xTitle}</div>}
      {hover !== null && items[hover] && (
        <div className={`sv-tip${tipX > width - 90 ? ' is-left' : ''}`} style={{ left: tipX, top: tipY }}>
          <b>{items[hover]!.value === null ? 'No data' : fmt(items[hover]!.value!, unit)}</b>
          <span>
            {items[hover]!.name ?? items[hover]!.label}
            {items[hover]!.sub ? ` · ${items[hover]!.sub}` : ''}
          </span>
        </div>
      )}
      <TableView caption={label} rows={items.map((it) => [it.name ?? it.label, it.value === null ? '—' : fmt(it.value, unit), it.sub ?? ''])} head={['', 'Value', '']} />
    </div>
  );
}

/** The chart's table-view twin (collapsed by default). */
export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  // The table mounts only while open (a closed <details> still lays out its content in some browsers).
  const [open, setOpen] = useState(false);
  return (
    <details className="sv-table" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Table</summary>
      {open && (
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
