// The rolling-accuracy line (the desktop app's trend chart): one series,
// 2px, its segments in the status band of each point (≥ 90 good, ≥ 75
// warning, else critical — the legend says so), 80% and 95% target lines,
// a crosshair that snaps to the nearest decision with a tooltip, and the
// line drawn in from the left.

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { STATUS, bandOf, niceTicks, type Band } from '@/math/statsView';
import { useWidth } from './useSize';

const BAND_COLOR: Record<Band, string> = { good: STATUS.good, warning: STATUS.warning, critical: STATUS.critical };
const BAND_NAME: Record<Band, string> = { good: '90% +', warning: '75–89%', critical: 'Below 75%' };

export function TrendChart({
  values,
  offset = 0,
  window: win,
  height = 220,
  label,
  targets = [80, 95],
}: {
  /** Rolling accuracy (%) per point. */
  values: readonly number[];
  /** Index of the first point's decision (1-based count of decisions before it). */
  offset?: number;
  window: number;
  height?: number;
  label: string;
  targets?: number[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId().replace(/:/g, '');
  const left = 36;
  const right = 34;
  const top = 12;
  const bottom = 26;
  const plotW = Math.max(80, width - left - right);
  const plotH = height - top - bottom;
  const n = values.length;
  const xOf = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  // Contiguous runs of one band; each segment takes the band of its end point.
  const runs: { band: Band; d: string }[] = [];
  for (let i = 1; i < n; i++) {
    const band = bandOf(values[i]!);
    const seg = `L${xOf(i).toFixed(1)} ${yOf(values[i]!).toFixed(1)}`;
    const last = runs[runs.length - 1];
    if (last && last.band === band) last.d += seg;
    else runs.push({ band, d: `M${xOf(i - 1).toFixed(1)} ${yOf(values[i - 1]!).toFixed(1)}${seg}` });
  }
  if (n === 1) runs.push({ band: bandOf(values[0]!), d: `M${xOf(0) - 1} ${yOf(values[0]!)}h2` });

  const decisions = offset + n;
  const xTicks = niceTicks(decisions, width < 420 ? 3 : 5).filter((t) => t >= offset + 1 || t === 0);

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const x = clientX - r.left;
    const i = Math.round(((x - left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget);
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    e.stopPropagation();
    const step = Math.max(1, Math.round(n / 40));
    setHover((h) => {
      const cur = h ?? n - 1;
      if (e.key === 'Home') return 0;
      if (e.key === 'End') return n - 1;
      return Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowLeft' ? -step : step)));
    });
  };
  const hv = hover === null ? null : values[hover]!;
  const bandsUsed = new Set(values.map(bandOf));

  return (
    <div className="sv sv-trend" ref={ref}>
      <svg
        className="sv-svg"
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Latest ${Math.round(values[n - 1] ?? 0)}%. Arrow keys move the crosshair.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <clipPath id={`reveal-${clip}`}>
            <rect className="sv-reveal" x={left - 4} y={0} width={plotW + 8} height={height} />
          </clipPath>
        </defs>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'sv-base' : 'sv-grid'} x1={left} x2={left + plotW} y1={yOf(t)} y2={yOf(t)} />
            <text className="sv-tick" x={left - 6} y={yOf(t)} textAnchor="end" dominantBaseline="central">
              {t}
              {t === 100 ? '%' : ''}
            </text>
          </g>
        ))}
        {targets.map((t) => (
          <g key={`t${t}`}>
            <line className="sv-target" x1={left} x2={left + plotW} y1={yOf(t)} y2={yOf(t)} />
            <text className="sv-target-label" x={left + plotW + 5} y={yOf(t)} dominantBaseline="central">
              {t}%
            </text>
          </g>
        ))}
        {xTicks.map((t) => {
          const i = t - offset - 1;
          if (i < 0 || i > n - 1) return null;
          return (
            <text key={`x${t}`} className="sv-tick" x={xOf(i)} y={top + plotH + 16} textAnchor="middle">
              {t.toLocaleString('en-US')}
            </text>
          );
        })}
        <g clipPath={`url(#reveal-${clip})`}>
          {runs.map((r, i) => (
            <path key={i} d={r.d} fill="none" stroke={BAND_COLOR[r.band]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>
        {n > 0 && hover === null && (
          <circle className="sv-dot" cx={xOf(n - 1)} cy={yOf(values[n - 1]!)} r={4.5} fill={BAND_COLOR[bandOf(values[n - 1]!)]} />
        )}
        {hover !== null && hv !== null && (
          <g pointerEvents="none">
            <line className="sv-cross" x1={xOf(hover)} x2={xOf(hover)} y1={top} y2={top + plotH} />
            <circle className="sv-dot" cx={xOf(hover)} cy={yOf(hv)} r={4.5} fill={BAND_COLOR[bandOf(hv)]} />
          </g>
        )}
      </svg>
      {hover !== null && hv !== null && (
        <div className={`sv-tip sv-tip-side${xOf(hover) > width - 150 ? ' is-left' : ''}`} style={{ left: xOf(hover), top: top }}>
          <b>{Math.round(hv)}%</b>
          <span>
            decisions {Math.max(1, offset + hover + 2 - win).toLocaleString('en-US')}–{(offset + hover + 1).toLocaleString('en-US')}
          </span>
        </div>
      )}
      <div className="sv-legend" aria-hidden>
        {(['good', 'warning', 'critical'] as Band[])
          .filter((b) => bandsUsed.has(b))
          .map((b) => (
            <span key={b} className="sv-legend-item">
              <i className="sv-key-line" style={{ background: BAND_COLOR[b] }} />
              {BAND_NAME[b]}
            </span>
          ))}
        <span className="sv-legend-item">
          <i className="sv-key-line is-target" />
          Target
        </span>
      </div>
    </div>
  );
}

/** A small single-series line of per-session values (no bands; the panel names it). */
export function SessionLine({ values, labels, height = 130, label, color }: { values: readonly number[]; labels: readonly string[]; height?: number; label: string; color: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const left = 34;
  const right = 12;
  const top = 12;
  const bottom = 20;
  const plotW = Math.max(60, width - left - right);
  const plotH = height - top - bottom;
  const n = values.length;
  const xOf = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join('');
  const hitW = n > 1 ? plotW / (n - 1) : plotW;
  return (
    <div className="sv" ref={ref}>
      <svg className="sv-svg" width={width} height={height} role="img" aria-label={label}>
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'sv-base' : 'sv-grid'} x1={left} x2={left + plotW} y1={yOf(t)} y2={yOf(t)} />
            <text className="sv-tick" x={left - 6} y={yOf(t)} textAnchor="end" dominantBaseline="central">
              {t}
              {t === 100 ? '%' : ''}
            </text>
          </g>
        ))}
        <path className="sv-line-draw" d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
        {values.map((v, i) => (
          <g
            key={i}
            tabIndex={0}
            className="sv-mark"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${labels[i]}: ${Math.round(v)}%`}
          >
            <rect x={xOf(i) - hitW / 2} y={top} width={hitW} height={plotH} fill="transparent" />
            {(hover === i || i === n - 1) && <circle className="sv-dot" cx={xOf(i)} cy={yOf(v)} r={4.5} fill={color} />}
          </g>
        ))}
        {n > 0 && hover === null && (
          <text className="sv-value" x={xOf(n - 1) - 8} y={yOf(values[n - 1]!) - 9} textAnchor="end">
            {Math.round(values[n - 1]!)}%
          </text>
        )}
      </svg>
      {hover !== null && (
        <div className={`sv-tip${xOf(hover) > width - 120 ? ' is-left' : ''}`} style={{ left: xOf(hover), top: 0 }}>
          <b>{Math.round(values[hover]!)}%</b>
          <span>{labels[hover]}</span>
        </div>
      )}
    </div>
  );
}
