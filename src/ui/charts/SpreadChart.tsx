// The analyzer's chart: two small multiples on one true-count axis (never a
// second y-scale). Top: how often each count comes up — gold where you bet,
// gray where you sit out. Bottom: what each count adds to (or costs) your EV,
// in units per 100 rounds — diverging blue / red around zero. One tooltip per
// count shows every value; the spread table beside it is the table view.

import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { TcRow } from '@/math/betSpread';
import { divergingTicks, niceTicks, tcLabel } from '@/math/spreadView';

const PANEL_H = 132;
const M = { top: 18, right: 6, bottom: 22, left: 38 };

function colPath(x: number, base: number, end: number, w: number, r = 4): string {
  const h = Math.abs(end - base);
  if (h < 0.5) return '';
  const rr = Math.min(r, h, w / 2);
  if (end < base) return `M${x} ${base}V${end + rr}Q${x} ${end} ${x + rr} ${end}H${x + w - rr}Q${x + w} ${end} ${x + w} ${end + rr}V${base}Z`;
  return `M${x} ${base}V${end - rr}Q${x} ${end} ${x + rr} ${end}H${x + w - rr}Q${x + w} ${end} ${x + w} ${end - rr}V${base}Z`;
}

const pctTick = (v: number) => `${Math.round(v * 10) / 10}%`;
const evTick = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(Math.abs(v) < 1 ? 1 : 0)}`);

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function SpreadChart({ rows, selected, hover, onHover, onSelect }: { rows: TcRow[]; selected: number; hover: number | null; onHover: (tc: number | null) => void; onSelect: (tc: number) => void }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const plotW = Math.max(0, width - M.left - M.right);
  const band = rows.length ? plotW / rows.length : 0;
  const barW = Math.max(2, Math.min(24, band - 3));
  const every = band >= 21 ? 1 : 2;
  const x0 = (i: number) => M.left + i * band;
  const plotH = PANEL_H - M.top - M.bottom;

  // Panel 1: frequency (%).
  const freqs = rows.map((r) => r.freq * 100);
  const fTicks = niceTicks(Math.max(...freqs, 1), 3);
  const fMax = fTicks[fTicks.length - 1]!;
  const fy = (v: number) => M.top + plotH - (v / fMax) * plotH;
  const peak = freqs.indexOf(Math.max(...freqs));

  // Panel 2: EV contribution (units / 100 rounds).
  const evs = rows.map((r) => r.ev * 100);
  const eTicks = divergingTicks(Math.min(0, ...evs), Math.max(0, ...evs), 3);
  const eMin = eTicks[0]!;
  const eMax = eTicks[eTicks.length - 1]!;
  const span = eMax - eMin || 1;
  const ey = (v: number) => M.top + ((eMax - v) / span) * plotH;
  const best = evs.indexOf(Math.max(...evs));

  const shown = hover ?? null;
  const ti = shown === null ? -1 : rows.findIndex((r) => r.tc === shown);
  const tip = ti >= 0 ? rows[ti]! : null;

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - M.left) / band);
    if (i >= 0 && i < rows.length) onHover(rows[i]!.tc);
    else onHover(null);
  };
  const tap = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - M.left) / band);
    if (i >= 0 && i < rows.length) {
      onSelect(rows[i]!.tc);
      onHover(rows[i]!.tc);
    }
  };

  const xLabels = (y: number) =>
    rows.map((r, i) =>
      r.tc % every === 0 || every === 1 ? (
        <text key={r.tc} x={x0(i) + band / 2} y={y} className={`viz-x${r.tc === selected ? ' is-sel' : ''}`} textAnchor="middle">
          {tcLabel(r.tc)}
        </text>
      ) : null,
    );

  const selIdx = rows.findIndex((r) => r.tc === selected);
  const bandRect = (i: number, cls: string) => (i >= 0 ? <rect className={cls} x={x0(i) + 0.5} y={M.top - 6} width={Math.max(0, band - 1)} height={plotH + 6} rx={5} /> : null);

  return (
    <div className="viz" ref={wrap}>
      {width > 0 && (
        <>
          <div className="viz-head">
            <span className="viz-title">Rounds at each true count</span>
            <span className="viz-legend">
              <span className="viz-key">
                <i className="viz-swatch viz-bet" /> Betting
              </span>
              <span className="viz-key">
                <i className="viz-swatch viz-out" /> Sitting out
              </span>
            </span>
          </div>
          <svg width={width} height={PANEL_H} onPointerMove={move} onPointerDown={tap} onPointerLeave={() => onHover(null)} role="img" aria-label="Share of rounds at each true count; gold where the spread bets, gray where it sits out.">
            {bandRect(selIdx, 'viz-sel')}
            {bandRect(ti, 'viz-hover')}
            {fTicks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'viz-base' : 'viz-grid'} x1={M.left} x2={width - M.right} y1={fy(t)} y2={fy(t)} />
                <text className="viz-y" x={M.left - 6} y={fy(t) + 3.5} textAnchor="end">
                  {pctTick(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => (
              <path key={r.tc} className={`viz-col ${r.bet > 0 ? 'viz-bet' : 'viz-out'}${i === ti ? ' is-hover' : ''}`} d={colPath(x0(i) + (band - barW) / 2, fy(0), fy(freqs[i]!), barW)} />
            ))}
            {peak >= 0 && (
              <text className="viz-label" x={x0(peak) + band / 2} y={fy(freqs[peak]!) - 5} textAnchor="middle">
                {Math.round(freqs[peak]!)}%
              </text>
            )}
            {xLabels(PANEL_H - 6)}
          </svg>

          <div className="viz-head">
            <span className="viz-title">EV by true count · units per 100 rounds</span>
            <span className="viz-legend">
              <span className="viz-key">
                <i className="viz-swatch viz-gain" /> Adds EV
              </span>
              <span className="viz-key">
                <i className="viz-swatch viz-cost" /> Costs EV
              </span>
            </span>
          </div>
          <svg width={width} height={PANEL_H} onPointerMove={move} onPointerDown={tap} onPointerLeave={() => onHover(null)} role="img" aria-label="Expected value each true count contributes, in units per 100 rounds: blue where it adds, red where it costs.">
            {bandRect(selIdx, 'viz-sel')}
            {bandRect(ti, 'viz-hover')}
            {eTicks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'viz-base' : 'viz-grid'} x1={M.left} x2={width - M.right} y1={ey(t)} y2={ey(t)} />
                <text className="viz-y" x={M.left - 6} y={ey(t) + 3.5} textAnchor="end">
                  {evTick(t)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => (
              <path key={r.tc} className={`viz-col ${evs[i]! >= 0 ? 'viz-gain' : 'viz-cost'}${i === ti ? ' is-hover' : ''}`} d={colPath(x0(i) + (band - barW) / 2, ey(0), ey(evs[i]!), barW)} />
            ))}
            {best >= 0 && evs[best]! > 0 && (
              <text className="viz-label" x={x0(best) + band / 2} y={ey(evs[best]!) - 5} textAnchor="middle">
                +{evs[best]!.toFixed(2)}
              </text>
            )}
            {xLabels(PANEL_H - 6)}
          </svg>

          {tip && (
            <div
              className="viz-tip"
              style={x0(ti) + band / 2 > width / 2 ? { left: Math.max(0, x0(ti) - 190) } : { left: Math.min(width - 184, x0(ti) + band + 6) }}
              role="status"
            >
              <span className="viz-tip-tc">TC {tcLabel(tip.tc)}</span>
              <span className="viz-tip-row">
                <i className={`viz-line ${tip.bet > 0 ? 'viz-bet' : 'viz-out'}`} />
                <b>{(tip.freq * 100).toFixed(1)}%</b> of rounds
              </span>
              <span className="viz-tip-row">
                <i className={`viz-line ${tip.ev >= 0 ? 'viz-gain' : 'viz-cost'}`} />
                <b>
                  {tip.ev >= 0 ? '+' : '−'}
                  {Math.abs(tip.ev * 100).toFixed(2)}u
                </b>{' '}
                per 100 rounds
              </span>
              <span className="viz-tip-sub">
                {tip.bet > 0 ? `Bet ${tip.bet}u` : 'Sit out'} · edge {tip.edge >= 0 ? '+' : '−'}
                {Math.abs(tip.edge).toFixed(2)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
