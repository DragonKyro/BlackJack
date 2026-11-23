// Stats & Analytics: Summary, Heatmap, Trend and Sessions over your training
// record (the desktop app's pandas summary, matplotlib heatmap and trend, and
// the Plotly report's panels, as interactive SVG). One filter row on top
// scopes every chart below it.

import { useMemo, useState, type CSSProperties } from 'react';
import { UP_COLS } from '@/bj/cards';
import { heatmap, leaks, rolling, summarize, type Cell, type Drill } from '@/math/analytics';
import {
  SERIES_1,
  cellAnswers,
  dateText,
  durationText,
  errorByUp,
  filterDrills,
  pctOf,
  samplePoints,
  sessionHeadline,
  sessionMetrics,
  totals,
  type Metric,
  type ModeFilter,
} from '@/math/statsView';
import { useConfig } from '@/store/configStore';
import { sessionsOf, useStats, type PlayRecord, type Session, type SessionMode } from '@/store/statsStore';
import { rowLabel, type Action, type HandType } from '@/strategy/tables';
import { BarList, ColumnChart, TableView } from '../charts/Bars';
import { HeatLegend, Heatmap } from '../charts/Heatmap';
import { SessionLine, TrendChart } from '../charts/TrendChart';
import { formatMoney } from '../chips/chipArt';
import { back, go, paths, type StatsTab } from '../router';
import { Modal, Segmented, TopBar, useHotkeys } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { ActionPill } from '../shared/StrategyGrid';


const TABS: { id: StatsTab; name: string }[] = [
  { id: 'summary', name: 'Summary' },
  { id: 'heatmap', name: 'Heatmap' },
  { id: 'trend', name: 'Trend' },
  { id: 'sessions', name: 'Sessions' },
];

const MODE_OPTIONS: { value: ModeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'smart', label: 'Smart' },
  { value: 'play', label: 'Play' },
];

const SESSION_NAME: Record<SessionMode, string> = { counting: 'Counting', bet: 'Bet trainer', smart: 'Smart trainer', play: 'Play' };
const TYPE_NAME: Record<HandType, string> = { hard: 'Hard', soft: 'Soft', pair: 'Pairs' };

/** "Hard 16", "Soft 18 (A,7)", "Pair 8,8". */
export function cellName(type: HandType, row: string): string {
  if (type === 'hard') return `Hard ${row}`;
  if (type === 'soft') return `Soft ${row} (${rowLabel('soft', row)})`;
  return `Pair ${rowLabel('pair', row)}`;
}

function drillTheseLeaks(): void {
  useConfig.getState().update('strategy', { mode: 'smart' });
  go(paths.go('strategy'));
}

export function StatsPage({ tab }: { tab: StatsTab }) {
  const all = useStats((s) => s.drills);
  const sessions = useStats((s) => s.sessions);
  const play = useStats((s) => s.play);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [sessMode, setSessMode] = useState<'all' | SessionMode>('all');
  const [confirm, setConfirm] = useState(false);
  const drills = useMemo(() => filterDrills(all, mode), [all, mode]);

  const switchTab = (d: number) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + d + TABS.length) % TABS.length]!;
    go(paths.stats(next.id), true);
  };
  useHotkeys({ ArrowLeft: () => switchTab(-1), ArrowRight: () => switchTab(1), Escape: () => back(paths.home) }, !confirm);

  const hasAnything = all.length > 0 || Object.keys(sessions).length > 0 || play.hands > 0;

  return (
    <div className="page page-wide stats-page">
      <TopBar
        title="Stats & Analytics"
        sub="Your training record"
        backTo={paths.home}
        right={
          <button type="button" className="icon-btn" onClick={() => setConfirm(true)} disabled={!hasAnything} aria-label="Clear stats" title="Clear stats">
            <Icon name="trash" />
          </button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Stats views">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === tab} onClick={() => go(paths.stats(t.id), true)}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="stats-filters">
        {tab === 'sessions' ? (
          <Segmented<'all' | SessionMode>
            label="Session type"
            value={sessMode}
            onChange={setSessMode}
            options={[
              { value: 'all', label: 'All' },
              { value: 'counting', label: 'Counting' },
              { value: 'bet', label: 'Bet' },
              { value: 'smart', label: 'Smart' },
              { value: 'play', label: 'Play' },
            ]}
          />
        ) : (
          <>
            <Segmented<ModeFilter> label="Decisions from" value={mode} onChange={setMode} options={MODE_OPTIONS} />
            <span className="stats-count faint">{drills.length.toLocaleString('en-US')} decisions</span>
          </>
        )}
      </div>

      {tab === 'summary' && <Summary key={mode} drills={drills} sessions={sessions} play={play} />}
      {tab === 'heatmap' && <HeatmapTab key={mode} drills={drills} hotkeys={!confirm} />}
      {tab === 'trend' && <TrendTab key={mode} drills={drills} sessions={sessions} />}
      {tab === 'sessions' && <SessionsTab key={sessMode} sessions={sessions} mode={sessMode} />}

      {confirm && (
        <Modal
          title="Clear stats?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  useStats.getState().clearAll();
                  setConfirm(false);
                }}
              >
                <Icon name="trash" size="sm" /> Clear everything
              </button>
            </>
          }
        >
          <p className="muted" style={{ margin: 0 }}>
            This removes every strategy decision, every trainer session and resets the Play bankroll — on this device and, when you're signed in, on your other devices too. Your settings and saved bet spread stay.
          </p>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- summary

function NoDecisions({ filtered }: { filtered: boolean }) {
  return (
    <div className="card-panel panel empty stats-empty">
      <Icon name="target" size="lg" className="stats-empty-icon" />
      <h2>{filtered ? 'No decisions from this mode yet' : 'No strategy decisions yet'}</h2>
      <p>Every play you make in the Strategy and Smart trainers — and at the Play table with the coach on — lands here.</p>
      <div className="stats-empty-go">
        <button type="button" className="btn" onClick={() => go(paths.setup('strategy'))}>
          <Icon name="play" size="sm" /> Strategy trainer
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go(paths.setup('play'))}>
          Play a hand
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone, i = 0 }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg'; i?: number }) {
  return (
    <div className="tile-stat" style={{ '--i': i } as CSSProperties}>
      <span className="tile-label">{label}</span>
      <span className={`tile-value${tone ? ` ${tone}` : ''}`}>{value}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

const pctLabel = (p: number | null) => (p === null ? '—' : `${Math.round(p)}%`);

function Summary({ drills, sessions, play }: { drills: Drill[]; sessions: Record<string, Session>; play: PlayRecord }) {
  const s = useMemo(() => summarize(drills), [drills]);
  const ups = useMemo(() => errorByUp(drills), [drills]);
  const holes = useMemo(() => leaks(drills, 8), [drills]);
  const filtered = useStats((st) => st.drills.length) > 0;
  const trainers = (['counting', 'bet', 'smart', 'play'] as SessionMode[]).map((m) => ({ mode: m, t: totals(sessionsOf(sessions, m)) })).filter((x) => x.t.sessions > 0);

  return (
    <div className="stats-grid">
      {drills.length === 0 ? (
        <div className="span-2">
          <NoDecisions filtered={filtered} />
        </div>
      ) : (
        <>
          <section className="card-panel panel stats-hero span-2" aria-label="Accuracy">
            <div className="hero-figure">
              <span className="hero-number">{Math.round(s.pct)}%</span>
              <span className="hero-caption">
                {s.correct.toLocaleString('en-US')} of {s.total.toLocaleString('en-US')} decisions right
              </span>
            </div>
            <div className="tile-row">
              <Tile i={0} label="Last 10" value={pctLabel(Math.min(10, s.total) ? s.last10 : null)} />
              <Tile i={1} label="Last 50" value={pctLabel(s.total ? s.last50 : null)} sub={s.total < 50 ? `${s.total} so far` : undefined} />
              <Tile i={2} label="Streak" value={String(s.streak)} sub={`best ${s.best}`} />
              <Tile i={3} label="Missed" value={(s.total - s.correct).toLocaleString('en-US')} />
            </div>
          </section>

          <section className="card-panel panel">
            <h2>Accuracy by hand type</h2>
            <BarList
              label="Accuracy by hand type"
              items={(['hard', 'soft', 'pair'] as HandType[]).map((t) => ({
                key: t,
                label: TYPE_NAME[t],
                value: pctOf(s.byType[t].correct, s.byType[t].total),
                sub: `${s.byType[t].correct} of ${s.byType[t].total} right`,
              }))}
            />
          </section>

          <section className="card-panel panel">
            <h2>Error rate by dealer up card</h2>
            <ColumnChart
              label="Error rate by dealer up card"
              items={ups.map((u) => ({ key: u.col, label: u.col, name: `Dealer ${u.col === 'A' ? 'ace' : u.col}`, value: u.rate, sub: `${u.wrong} of ${u.n} wrong` }))}
              max={Math.max(10, ...ups.map((u) => u.rate ?? 0))}
              xTitle="Dealer up card"
            />
          </section>

          <section className="card-panel panel span-2">
            <div className="panel-head">
              <h2>Biggest leaks</h2>
              {holes.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={drillTheseLeaks}>
                  <Icon name="target" size="sm" /> Drill these
                </button>
              )}
            </div>
            {holes.length === 0 ? (
              <p className="muted leak-none">
                <Icon name="check" size="sm" /> No misses{drills.length < 30 ? ' yet' : ' — every spot right'}.
              </p>
            ) : (
              <ol className="leaks">
                {holes.map((l, i) => (
                  <li key={`${l.type}-${l.row}-${l.up}`} className="leak" style={{ '--i': i } as CSSProperties}>
                    <span className="leak-rank">{i + 1}</span>
                    <span className="leak-what">
                      <b>
                        {cellName(l.type, l.row)} vs {l.up}
                      </b>
                      <span className="faint">
                        {l.wrong} of {l.n} wrong
                      </span>
                    </span>
                    <span className="leak-plays">
                      <span className="leak-play">
                        <span className="faint">right</span> <ActionPill a={l.ans} long />
                      </span>
                      <span className="leak-play">
                        <span className="faint">you</span> <ActionPill a={l.your} long />
                      </span>
                    </span>
                    <span className="leak-bar" aria-hidden>
                      <i style={{ width: `${(l.wrong / l.n) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <section className="card-panel panel">
        <h2>Play table</h2>
        {play.hands === 0 ? (
          <p className="muted">
            No hands played yet.{' '}
            <button type="button" className="linkish" onClick={() => go(paths.setup('play'))}>
              Take a seat
            </button>
          </p>
        ) : (
          <div className="tile-grid">
            <Tile i={0} label="Bankroll" value={formatMoney(play.bankroll)} sub={play.rebuys ? `${play.rebuys} rebuy${play.rebuys > 1 ? 's' : ''}` : undefined} />
            <Tile i={1} label="Net" value={formatMoney(play.net, true)} tone={play.net > 0 ? 'pos' : play.net < 0 ? 'neg' : undefined} />
            <Tile i={2} label="Hands" value={play.hands.toLocaleString('en-US')} sub={`${pctLabel(pctOf(play.won, play.hands))} won`} />
            <Tile i={3} label="W · L · P" value={`${play.won} · ${play.lost} · ${play.pushed}`} />
            <Tile i={4} label="Blackjacks" value={String(play.blackjacks)} />
            <Tile i={5} label="Peak" value={formatMoney(play.peak)} />
          </div>
        )}
      </section>

      <section className="card-panel panel">
        <h2>Trainers</h2>
        {trainers.length === 0 ? (
          <p className="muted">Counting, bet and smart trainer sessions show up here.</p>
        ) : (
          <ul className="trainer-list">
            {trainers.map(({ mode, t }) => (
              <li key={mode}>
                <span className="trainer-name">
                  {SESSION_NAME[mode]}
                  <span className="faint">
                    {t.sessions} session{t.sessions > 1 ? 's' : ''}
                  </span>
                </span>
                <Metrics items={sessionMetrics(mode, t.n).slice(0, 4)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metrics({ items }: { items: Metric[] }) {
  return (
    <span className="metrics">
      {items.map((m) => (
        <span key={m.label} className="metric">
          <span className={`metric-value${m.tone ? ` ${m.tone}` : ''}`}>{m.value}</span>
          <span className="metric-label">{m.label}</span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- heatmap

const HM_TYPES: HandType[] = ['hard', 'soft', 'pair'];

function HeatmapTab({ drills, hotkeys }: { drills: Drill[]; hotkeys: boolean }) {
  const [type, setType] = useState<HandType>('hard');
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const hm = useMemo(() => heatmap(drills, type), [drills, type]);
  const answers = useMemo(() => cellAnswers(drills, type), [drills, type]);
  const cycle = (d: number) => {
    setType((t) => HM_TYPES[(HM_TYPES.indexOf(t) + d + HM_TYPES.length) % HM_TYPES.length]!);
    setSel(null);
  };
  useHotkeys({ q: () => cycle(-1), w: () => cycle(1) }, hotkeys);

  const count = hm.cells.reduce((n, row) => n + row.reduce((m, c) => m + c.n, 0), 0);
  let worst: { r: number; c: number; rate: number } | null = null;
  hm.cells.forEach((row, r) =>
    row.forEach((c, ci) => {
      if (c.n === 0 || c.wrong === 0) return;
      const rate = c.wrong / c.n;
      if (!worst || rate > worst.rate || (rate === worst.rate && c.wrong > hm.cells[worst.r]![worst.c]!.wrong)) worst = { r, c: ci, rate };
    }),
  );
  const w = worst as { r: number; c: number; rate: number } | null;

  return (
    <section className="card-panel panel hm-panel">
      <div className="panel-head">
        <h2>Where the misses are</h2>
        <Segmented<HandType>
          label="Chart"
          value={type}
          onChange={(t) => {
            setType(t);
            setSel(null);
          }}
          options={HM_TYPES.map((t) => ({ value: t, label: TYPE_NAME[t] }))}
        />
      </div>
      <p className="hm-sub faint">
        Error rate (%) for each hand against each dealer up card · {count.toLocaleString('en-US')} decisions · <kbd>Q</kbd> <kbd>W</kbd> switch charts
      </p>
      <Heatmap type={type} rows={hm.rows} cells={hm.cells} selected={sel} onSelect={setSel} />
      <div className="hm-detail" aria-live="polite">
        {sel ? (
          <CellDetail type={type} row={hm.rows[sel.r]!} col={UP_COLS[sel.c]!} cell={hm.cells[sel.r]![sel.c]!} ans={answers.get(`${hm.rows[sel.r]}|${UP_COLS[sel.c]}`)} />
        ) : count === 0 ? (
          <span className="muted">No {TYPE_NAME[type].toLowerCase()} decisions yet.</span>
        ) : w ? (
          <span className="muted">
            Hover or tap a cell. Worst spot:{' '}
            <button type="button" className="linkish" onClick={() => setSel({ r: w.r, c: w.c })}>
              {cellName(type, hm.rows[w.r]!)} vs {UP_COLS[w.c]} ({Math.round(w.rate * 100)}%)
            </button>
          </span>
        ) : (
          <span className="muted">
            <Icon name="check" size="sm" /> Not a single miss on this chart.
          </span>
        )}
      </div>
      <HeatLegend />
    </section>
  );
}

function CellDetail({ type, row, col, cell, ans }: { type: HandType; row: string; col: string; cell: Cell; ans: Action | undefined }) {
  if (cell.n === 0)
    return (
      <span>
        <b>
          {cellName(type, row)} vs {col}
        </b>{' '}
        <span className="muted">— not dealt yet</span>
      </span>
    );
  return (
    <span className="hm-detail-line">
      <b>
        {cellName(type, row)} vs {col}
      </b>
      <span>
        <span className="hm-detail-num">
          {cell.wrong} of {cell.n}
        </span>{' '}
        wrong ({Math.round((cell.wrong / cell.n) * 100)}%)
      </span>
      {ans && (
        <span>
          right play <ActionPill a={ans} long />
        </span>
      )}
      {cell.yours.length > 0 && (
        <span>
          you played{' '}
          {cell.yours.map(([a, k]) => (
            <span key={a} className="hm-yours">
              <ActionPill a={a} long /> ×{k}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- trend

const WINDOW = 20;

function TrendTab({ drills, sessions }: { drills: Drill[]; sessions: Record<string, Session> }) {
  const values = useMemo(() => rolling(drills, WINDOW), [drills]);
  const latest = values[values.length - 1];
  const best = values.length ? Math.max(...values) : 0;
  const step = Math.max(WINDOW, Math.ceil(values.length / 40 / WINDOW) * WINDOW);
  const table = useMemo(() => samplePoints(values, step), [values, step]);

  const series = (['counting', 'bet', 'smart'] as SessionMode[])
    .map((m) => {
      const list = sessionsOf(sessions, m)
        .map((s) => ({ s, v: sessionHeadline(m, s.n) }))
        .filter((x): x is { s: Session; v: number } => x.v !== null)
        .slice(-30);
      return { mode: m, list };
    })
    .filter((x) => x.list.length > 0);
  const SERIES_TITLE: Record<string, string> = { counting: 'Counting — exact answers per session', bet: 'Bet trainer — bets right per session', smart: 'Smart trainer — bets right per session' };

  return (
    <div className="stats-grid">
      <section className="card-panel panel span-2">
        <div className="panel-head">
          <h2>Rolling {WINDOW}-decision accuracy</h2>
          {latest !== undefined && (
            <span className="trend-now">
              <b>{Math.round(latest)}%</b> <span className="faint">now · best {Math.round(best)}%</span>
            </span>
          )}
        </div>
        {values.length === 0 ? (
          <div className="empty">
            Need at least {WINDOW} decisions for a trend — you have {drills.length}.
            <div>
              <button type="button" className="btn" onClick={() => go(paths.setup('strategy'))}>
                <Icon name="play" size="sm" /> Strategy trainer
              </button>
            </div>
          </div>
        ) : (
          <>
            <TrendChart values={values} offset={WINDOW - 1} window={WINDOW} label={`Rolling ${WINDOW}-decision accuracy`} />
            <TableView caption="Rolling accuracy" head={['Decisions', 'Accuracy']} rows={table.map((p) => [`${Math.max(1, p.i + 1).toLocaleString('en-US')}–${(p.i + WINDOW).toLocaleString('en-US')}`, `${Math.round(p.v)}%`])} />
          </>
        )}
      </section>
      {series.map(({ mode, list }) => (
        <section key={mode} className="card-panel panel">
          <h2>{SERIES_TITLE[mode]}</h2>
          {list.length < 2 ? (
            <p className="muted">
              One session so far: <b>{Math.round(list[0]!.v)}%</b>. A line appears from the second.
            </p>
          ) : (
            <>
              <SessionLine label={SERIES_TITLE[mode]!} color={SERIES_1} values={list.map((x) => x.v)} labels={list.map((x) => dateText(x.s.ts))} />
              <TableView caption={SERIES_TITLE[mode]!} head={['Session', '%']} rows={list.map((x) => [dateText(x.s.ts), `${Math.round(x.v)}%`])} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- sessions

function SessionsTab({ sessions, mode }: { sessions: Record<string, Session>; mode: 'all' | SessionMode }) {
  const [limit, setLimit] = useState(40);
  const list = useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => mode === 'all' || s.mode === mode)
        .sort((a, b) => b.ts - a.ts),
    [sessions, mode],
  );
  if (list.length === 0)
    return (
      <div className="card-panel panel empty">
        <Icon name="list" size="lg" className="stats-empty-icon" />
        <h2>No {mode === 'all' ? '' : `${SESSION_NAME[mode].toLowerCase()} `}sessions yet</h2>
        <p>Counting, bet and smart trainer runs and stretches at the Play table are logged as sessions.</p>
        <div className="stats-empty-go">
          <button type="button" className="btn" onClick={() => go(paths.setup(mode === 'all' ? 'counting' : mode))}>
            <Icon name="play" size="sm" /> {mode === 'all' ? 'Counting trainer' : SESSION_NAME[mode]}
          </button>
        </div>
      </div>
    );
  return (
    <section className="card-panel panel">
      <ul className="sessions">
        {list.slice(0, limit).map((s, i) => (
          <li key={s.id} className={`sess sess-${s.mode}`} style={{ '--i': Math.min(i, 20) } as CSSProperties}>
            <span className="sess-head">
              <span className={`sess-badge sb-${s.mode}`}>{SESSION_NAME[s.mode]}</span>
              <span className="sess-when">
                {dateText(s.ts)}
                <span className="faint"> · {durationText(s.end - s.ts)}</span>
              </span>
              {s.setup && <span className="sess-setup faint">{s.setup}</span>}
            </span>
            <Metrics items={sessionMetrics(s.mode, s.n)} />
          </li>
        ))}
      </ul>
      {list.length > limit && (
        <div className="sess-more">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + 40)}>
            Show more ({list.length - limit})
          </button>
        </div>
      )}
    </section>
  );
}

