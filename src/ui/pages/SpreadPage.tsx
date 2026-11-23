// Bet spread analyzer: edit the units you bet at each true count and watch
// EV, standard deviation, risk of ruin and N0 move. Save the spread and the
// trainers grade your bets against it ("My spread").

import { useMemo, useState, type CSSProperties } from 'react';
import { rulesSummary } from '@/bj/rules';
import { BANKROLL_OPTIONS, HPH_OPTIONS, PRESETS, TCS, UNIT_OPTIONS, analyze, spreadName, type Spread } from '@/math/betSpread';
import { MAX_BET_UNITS, compact, fullSpread, rorLevel, sameSpread, tcLabel, withBet } from '@/math/spreadView';
import { useConfig } from '@/store/configStore';
import { TC_METHOD_NAME, usePrefs } from '@/store/prefsStore';
import { useStats } from '@/store/statsStore';
import { SpreadChart } from '../charts/SpreadChart';
import { formatMoney } from '../chips/chipArt';
import { back, paths } from '../router';
import { Cycle, Row, TopBar, useHotkeys, useTween } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { RulesEditor } from '../shared/RulesEditor';

const pct = (x: number, d = 2) => {
  const t = Math.abs(x).toFixed(d);
  return Number(t) === 0 ? `${t}%` : `${x > 0 ? '+' : '−'}${t}%`;
};

export function SpreadPage() {
  const { rules, settings } = useConfig((s) => s.analyzer);
  const update = useConfig((s) => s.update);
  const tcMethod = usePrefs((s) => s.tcMethod);
  const saved = useStats((s) => s.spread);
  const setSaved = useStats((s) => s.setSpread);
  const [spread, setSpread] = useState<Spread>(() => fullSpread(saved?.units ?? PRESETS['1-12']!.spread));
  const [sel, setSel] = useState(2);
  const [hover, setHover] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState(0);

  const res = useMemo(() => analyze(rules, spread, settings, tcMethod), [rules, spread, settings, tcMethod]);
  const isSaved = !!saved && sameSpread(saved.units, spread);
  const bump = (tc: number, d: number) => setSpread((s) => withBet(s, tc, (s[tc] ?? 1) + d));
  const move = (d: number) => setSel((tc) => Math.max(TCS[0]!, Math.min(TCS[TCS.length - 1]!, tc + d)));

  useHotkeys({
    ArrowUp: () => move(-1),
    ArrowDown: () => move(1),
    ArrowLeft: () => bump(sel, -1),
    ArrowRight: () => bump(sel, 1),
    '-': () => bump(sel, -1),
    '+': () => bump(sel, 1),
    '=': () => bump(sel, 1),
    Escape: () => back(paths.home),
  });

  const save = () => {
    setSaved(spread);
    setJustSaved((n) => n + 1);
  };

  const risk = rorLevel(res.ror);
  const evHour = useTween(res.evHour, 450);

  return (
    <div className="page page-wide spread-page">
      <TopBar backTo={paths.home} title="Bet Spread Analyzer" sub={`${rulesSummary(rules)} · ${Math.round(rules.penetration * 100)}% pen`} />

      <div className="spread-presets" role="group" aria-label="Spread presets">
        {Object.entries(PRESETS).map(([id, p]) => (
          <button key={id} type="button" className={`preset${sameSpread(p.spread, spread) ? ' is-on' : ''}`} onClick={() => setSpread(fullSpread(p.spread))} title={p.hint}>
            {p.name}
          </button>
        ))}
        {saved && (
          <button type="button" className={`preset${isSaved ? ' is-on' : ''}`} onClick={() => setSpread(fullSpread(saved.units))} title="Your saved spread">
            <Icon name="check" size="sm" /> Saved
          </button>
        )}
        {!Object.values(PRESETS).some((p) => sameSpread(p.spread, spread)) && !isSaved && <span className="spread-name chip">{spreadName(spread)}</span>}
        <button key={justSaved} type="button" className={`btn btn-sm spread-save${justSaved ? ' did-save' : ''}`} onClick={save} disabled={isSaved}>
          {isSaved ? 'Saved as my spread' : 'Save as my spread'}
        </button>
      </div>

      <div className="spread-layout">
        <section className="panel spread-table-panel">
          <div className="spread-table" role="table" aria-label="Bet units at each true count">
            <div className="st-row st-head" role="row">
              <span role="columnheader">TC</span>
              <span role="columnheader">Bet</span>
              <span role="columnheader">Rounds</span>
              <span role="columnheader">Edge</span>
              <span role="columnheader" title="Units per 100 rounds">
                EV/100
              </span>
            </div>
            {res.rows.map((r, i) => {
              const ev100 = r.ev * 100;
              return (
                <div
                  key={r.tc}
                  role="row"
                  className={`st-row${r.tc === sel ? ' is-sel' : ''}${r.tc === hover ? ' is-hover' : ''}${r.bet === 0 ? ' is-out' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => setSel(r.tc)}
                  onPointerEnter={() => setHover(r.tc)}
                  onPointerLeave={() => setHover(null)}
                >
                  <span role="cell" className={`st-tc${r.tc > 0 ? ' is-pos' : r.tc < 0 ? ' is-neg' : ''}`}>
                    {tcLabel(r.tc)}
                  </span>
                  <span role="cell" className="st-bet">
                    <button type="button" className="st-step" aria-label={`Bet less at TC ${tcLabel(r.tc)}`} disabled={r.bet <= 0} onClick={(e) => (e.stopPropagation(), setSel(r.tc), bump(r.tc, -1))}>
                      <Icon name="minus" size="sm" />
                    </button>
                    <span key={r.bet} className="st-units">
                      {r.bet > 0 ? `${r.bet}u` : <span className="faint">out</span>}
                    </span>
                    <button type="button" className="st-step" aria-label={`Bet more at TC ${tcLabel(r.tc)}`} disabled={r.bet >= MAX_BET_UNITS} onClick={(e) => (e.stopPropagation(), setSel(r.tc), bump(r.tc, 1))}>
                      <Icon name="plus" size="sm" />
                    </button>
                  </span>
                  <span role="cell" className="st-num">
                    {(r.freq * 100).toFixed(1)}%
                  </span>
                  <span role="cell" className={`st-num ${r.edge >= 0 ? 'pos' : 'neg'}`}>
                    {pct(r.edge, 1)}
                  </span>
                  <span role="cell" className={`st-num st-ev ${ev100 > 0.005 ? 'pos' : ev100 < -0.005 ? 'neg' : 'faint'}`}>
                    {r.bet === 0 ? '—' : Math.abs(ev100) < 0.005 ? '0.00' : `${ev100 > 0 ? '+' : '−'}${Math.abs(ev100).toFixed(2)}`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="spread-keys faint">
            <kbd>↑</kbd> <kbd>↓</kbd> pick a count · <kbd>←</kbd> <kbd>→</kbd> change its bet · 0 units sits the count out
          </p>
        </section>

        <div className="spread-side">
          <section className="panel spread-results" aria-live="polite">
            <div className="sp-hero">
              <span className="sp-hero-label">Expected win per hour</span>
              <span className={`sp-hero-value ${res.evHour >= 0 ? 'pos' : 'neg'}`}>{formatMoney(Math.round(evHour), true)}</span>
              <span className="sp-hero-sub muted">
                ± {formatMoney(Math.round(res.sdHour))} standard deviation · {settings.handsPerHour} rounds/h at {formatMoney(settings.unit)} a unit
              </span>
            </div>
            <div className="sp-stat-grid">
              <Stat label="Risk of ruin" value={res.ror >= 99.95 ? '100%' : `${res.ror < 10 ? res.ror.toFixed(1) : Math.round(res.ror)}%`} sub={`with ${formatMoney(settings.bankroll)}`} status={risk} />
              <Stat label="N0" value={Number.isFinite(res.n0) ? compact(res.n0) : '∞'} sub={Number.isFinite(res.n0Hours) ? `rounds · ${compact(res.n0Hours)} hours` : 'never — no edge'} />
              <Stat label="Average bet" value={`${res.avgBet.toFixed(2)}u`} sub={formatMoney(Math.round(res.avgBet * settings.unit * 100) / 100)} />
              <Stat label="Rounds played" value={`${Math.round(res.playedPct)}%`} sub={res.playedPct < 99.5 ? 'sitting out the rest' : 'every round'} />
              <Stat label="Spread" value={res.ratio > 0 ? `1–${Math.round(res.ratio * 10) / 10}` : '—'} sub="biggest bet ÷ smallest" />
              <Stat label="Edge per unit bet" value={pct(res.edgeOverall)} sub={`base ${pct(res.baseEdge)} off the top`} tone={res.edgeOverall >= 0 ? 'pos' : 'neg'} />
              <Stat label="Bankroll for 5% risk" value={Number.isFinite(res.bankroll5) ? formatMoney(Math.ceil(res.bankroll5 / 100) * 100) : '—'} sub={Number.isFinite(res.bankroll5) ? `${compact(res.bankroll5 / settings.unit)} units` : 'no edge to protect'} />
              <Stat label="Bankroll for 1% risk" value={Number.isFinite(res.bankroll1) ? formatMoney(Math.ceil(res.bankroll1 / 100) * 100) : '—'} sub={Number.isFinite(res.bankroll1) ? `${compact(res.bankroll1 / settings.unit)} units` : 'no edge to protect'} />
            </div>
          </section>

          <section className="panel spread-chart-panel">
            <SpreadChart rows={res.rows} selected={sel} hover={hover} onHover={setHover} onSelect={setSel} />
          </section>

          <section className="panel spread-settings">
            <div className="section-h">Money</div>
            <Row label="Unit size">
              <Cycle label="unit size" value={settings.unit} options={UNIT_OPTIONS} onChange={(unit) => update('analyzer', { settings: { ...settings, unit } })} format={(v) => formatMoney(v)} clamp />
            </Row>
            <Row label="Bankroll">
              <Cycle label="bankroll" value={settings.bankroll} options={BANKROLL_OPTIONS} onChange={(bankroll) => update('analyzer', { settings: { ...settings, bankroll } })} format={(v) => formatMoney(v)} clamp />
            </Row>
            <Row label="Rounds per hour">
              <Cycle label="rounds per hour" value={settings.handsPerHour} options={HPH_OPTIONS} onChange={(handsPerHour) => update('analyzer', { settings: { ...settings, handsPerHour } })} clamp />
            </Row>
            <Row label="True count" hint="Change the rounding in Settings (⚙ on the home page)">
              <span className="chip">{TC_METHOD_NAME[tcMethod]}</span>
            </Row>
            <div className="section-h">Table</div>
            <RulesEditor rules={rules} onChange={(r) => update('analyzer', { rules: r })} show={{ decks: true, penetration: true, insurance: false }} />
          </section>
        </div>
      </div>

      <div className="spread-sticky" aria-hidden>
        <span className={res.evHour >= 0 ? 'pos' : 'neg'}>{formatMoney(Math.round(res.evHour), true)}/h</span>
        <span>
          RoR <b className={`sp-lvl-${risk.level}`}>{res.ror >= 99.95 ? '100' : res.ror < 10 ? res.ror.toFixed(1) : Math.round(res.ror)}%</b>
        </span>
        <span>N0 {Number.isFinite(res.n0) ? compact(res.n0) : '∞'}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, status, tone }: { label: string; value: string; sub?: string; status?: { level: 'good' | 'warning' | 'critical'; text: string }; tone?: 'pos' | 'neg' }) {
  return (
    <div className={`sp-stat${status ? ` sp-stat-${status.level}` : ''}`}>
      <span className="sp-stat-label">{label}</span>
      <span className={`sp-stat-value${tone ? ` ${tone}` : ''}`}>{value}</span>
      {status && (
        <span className={`sp-stat-status sp-lvl-${status.level}`}>
          <Icon name={status.level === 'good' ? 'check' : status.level === 'warning' ? 'info' : 'x'} size="sm" />
          {status.text}
        </span>
      )}
      {sub && <span className="sp-stat-sub faint">{sub}</span>}
    </div>
  );
}
