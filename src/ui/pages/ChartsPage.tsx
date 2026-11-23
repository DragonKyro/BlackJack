// Strategy charts: hard, soft and pairs for the chosen rules, and the index
// plays (Illustrious 18 + Fab 4). Tap a cell for what it means and whether
// a count deviation applies there.

import { useState, type CSSProperties } from 'react';
import { UP_COLS, type Card, type UpCol } from '@/bj/cards';
import { rulesSummary, type Rules } from '@/bj/rules';
import { useConfig } from '@/store/configStore';
import { TC_METHOD_NAME, usePrefs } from '@/store/prefsStore';
import { ACTION_NAME, DEVIATIONS, bestAction, chartAction, deviationRule, freshOptions, rowLabel, type Action, type Deviation, type HandType } from '@/strategy/tables';
import { back, go, paths, type ChartTab } from '../router';
import { Modal, TopBar, useHotkeys } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { RulesEditor } from '../shared/RulesEditor';
import { ActionLegend, ActionPill, StrategyGrid } from '../shared/StrategyGrid';
import { tcLabel } from '@/math/spreadView';

const TABS: { id: ChartTab; name: string }[] = [
  { id: 'hard', name: 'Hard' },
  { id: 'soft', name: 'Soft' },
  { id: 'pairs', name: 'Pairs' },
  { id: 'deviations', name: 'Index plays' },
];

const TYPE: Record<Exclude<ChartTab, 'deviations'>, HandType> = { hard: 'hard', soft: 'soft', pairs: 'pair' };

const TITLE: Record<Exclude<ChartTab, 'deviations'>, { h: string; sub: string }> = {
  hard: { h: 'Hard totals', sub: 'No ace, or an ace that must count 1' },
  soft: { h: 'Soft totals', sub: 'An ace counting 11 — you can’t bust on one card' },
  pairs: { h: 'Pairs', sub: 'Your first two cards match (ten-cards pair with each other)' },
};

export function ChartsPage({ tab }: { tab: ChartTab }) {
  const rules = useConfig((s) => s.charts.rules);
  const update = useConfig((s) => s.update);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cell, setCell] = useState<{ tab: ChartTab; row: string; col: UpCol } | null>(null);
  const idx = TABS.findIndex((t) => t.id === tab);
  const toTab = (t: ChartTab) => {
    setCell(null);
    go(paths.charts(t), true);
  };
  const step = (d: number) => toTab(TABS[(idx + d + TABS.length) % TABS.length]!.id);

  useHotkeys(
    {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      q: () => step(-1),
      w: () => step(1),
      Escape: () => (cell ? setCell(null) : back(paths.home)),
    },
    !rulesOpen,
  );

  return (
    <div className="page page-wide charts-page">
      <TopBar
        backTo={paths.home}
        title="Strategy Charts"
        sub={rulesSummary(rules)}
        right={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRulesOpen(true)}>
            <Icon name="gear" size="sm" /> Rules
          </button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Chart">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === tab} onClick={() => toTab(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      {tab === 'deviations' ? (
        <Deviations rules={rules} />
      ) : (
        <section key={tab} className="panel chart-sheet">
          <div className="chart-sheet-main">
            <div className="chart-sheet-head">
              <h2>{TITLE[tab].h}</h2>
              <span className="muted">{TITLE[tab].sub}</span>
            </div>
            <div className="chart-axis-note faint" aria-hidden>
              <span>You</span>
              <span>Dealer up card →</span>
            </div>
            <StrategyGrid
              rules={rules}
              type={TYPE[tab]}
              highlight={cell && cell.tab === tab ? { row: cell.row, col: cell.col } : null}
              onCell={(row, col) => setCell(cell && cell.tab === tab && cell.row === row && cell.col === col ? null : { tab, row, col })}
            />
            <ActionLegend />
          </div>
          <aside className="chart-sheet-side">
            {cell && cell.tab === tab ? <CellDetail rules={rules} type={TYPE[tab]} row={cell.row} col={cell.col} onClose={() => setCell(null)} /> : <p className="chart-tip faint">Tap a cell for what it means and whether a count changes it.</p>}
            <Notes rules={rules} tab={tab} />
          </aside>
        </section>
      )}

      {rulesOpen && (
        <Modal title="Table rules" onClose={() => setRulesOpen(false)} actions={<button type="button" className="btn" onClick={() => setRulesOpen(false)}>Done</button>}>
          <p className="muted modal-lead">Strategy changes with the dealer’s soft-17 rule, doubling, splitting, DAS and surrender. (Deck count and penetration barely move these charts.)</p>
          <RulesEditor rules={rules} onChange={(r) => update('charts', { rules: r })} show={{ decks: false, penetration: false, insurance: false }} />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the notes beside a chart

function Notes({ rules, tab }: { rules: Rules; tab: Exclude<ChartTab, 'deviations'> }) {
  const items: string[] = [];
  if (tab === 'hard') {
    items.push(rules.double ? 'Double on your first two cards (and after a split with DAS); with three or more cards, a double cell means hit.' : 'Doubling is off: the double cells hit.');
    items.push(rules.surrender ? 'Surrender only on your first two cards, before anything else; later, those cells hit (17 vs A stands).' : 'Late surrender is off — turn it on in Rules to see the surrender cells.');
    items.push(rules.h17 ? 'H17: double 11 vs A, surrender 15 and 17 vs A.' : 'S17: hit 11 vs A; 15 vs A hits.');
  } else if (tab === 'soft') {
    items.push(rules.double ? 'Soft doubles need two cards; on more, A-7 (soft 18) stands and the rest hit.' : 'Doubling is off: soft 18 stands where it would double, the other doubles hit.');
    items.push('Count the ace as 11 while you can — A-6-5 is hard 12, not soft 22.');
    items.push(rules.h17 ? 'H17: double A-8 vs 6 and A-7 vs 2.' : 'S17: A-8 always stands, A-7 vs 2 stands.');
  } else {
    items.push(rules.split ? 'Split up to four hands. Split aces get one card each and can’t be resplit.' : 'Splitting is off: every pair plays its total (A,A is soft 12 — hit).');
    if (rules.split) items.push(rules.das && rules.double ? 'With DAS: split 2s, 3s vs 2–3, 4s vs 5–6 and 6s vs 2.' : 'No DAS: those small pairs hit instead of splitting.');
    if (rules.split && rules.h17) items.push(rules.surrender ? '8,8 vs A under H17: surrender.' : '8,8 vs A under H17: split (surrender if it’s offered).');
    items.push('5,5 plays as hard 10; T,T always stands on basic strategy.');
  }
  return (
    <ul className="chart-notes">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** Cards that make a cell, to show in its detail. */
function sampleCards(type: HandType, row: string): Card[] {
  const ten = (v: number) => (v === 10 ? 'T' : v === 11 ? 'A' : String(v));
  if (type === 'pair') {
    const r = row === 'A' ? 'A' : row === '10' ? 'T' : row;
    return [`${r}S`, `${r}H`] as Card[];
  }
  if (type === 'soft') return ['AS', `${ten(Number(row) - 11)}H`] as Card[];
  const t = Number(row);
  const a = Math.min(10, t - 2);
  return [`${ten(a)}S`, `${ten(t - a)}H`] as Card[];
}

function matchingDeviation(type: HandType, row: string, col: UpCol): Deviation | null {
  return (
    DEVIATIONS.find((d) => d.up === col && ((d.kind === 'hard' && type === 'hard' && String(d.total) === row) || (d.kind === 'pair' && type === 'pair' && d.pair === row))) ?? null
  );
}

function CellDetail({ rules, type, row, col, onClose }: { rules: Rules; type: HandType; row: string; col: UpCol; onClose: () => void }) {
  const a: Action = chartAction(rules, type, row, col);
  const cards = sampleCards(type, row);
  // What the cell turns into when the hand has three or more cards (no double / surrender / split).
  const later = type === 'pair' ? null : bestAction(rules, cards, col, { ...freshOptions(rules), canDouble: false, canSurrender: false, canSplit: false });
  const dev = matchingDeviation(type, row, col);
  return (
    <div className="cell-detail" role="status">
      <div className="cell-detail-head">
        <span className="cell-detail-hand">
          {type === 'hard' ? `Hard ${row}` : type === 'soft' ? `Soft ${row} (${rowLabel('soft', row)})` : rowLabel('pair', row)}
          <span className="muted"> vs {col}</span>
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the cell detail">
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div className="cell-detail-play">
        <ActionPill a={a} long />
        {later && later !== a && (
          <span className="muted">
            {' '}
            · with 3+ cards: <ActionPill a={later} long />
          </span>
        )}
      </div>
      {dev ? (
        <p className="cell-detail-dev">
          <Icon name="bolt" size="sm" /> Index play ({dev.set === 'I18' ? 'Illustrious 18' : 'Fab 4'}): {deviationRule(dev)}.
          {dev.set === 'Fab4' && !rules.surrender ? ' Needs late surrender.' : ''}
        </p>
      ) : (
        <p className="cell-detail-dev faint">No common index play here — basic strategy holds at any count.</p>
      )}
      <span className="cell-detail-cols" aria-hidden>
        {UP_COLS.map((c) => (
          <i key={c} className={c === col ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- index plays

function Deviations({ rules }: { rules: Rules }) {
  const tcMethod = usePrefs((s) => s.tcMethod);
  const i18 = DEVIATIONS.filter((d) => d.set === 'I18');
  const fab = DEVIATIONS.filter((d) => d.set === 'Fab4');
  return (
    <div className="devs">
      <section className="panel dev-explain">
        <h2>Playing the count</h2>
        <p>
          Keep the Hi-Lo running count, divide it by the decks left (to the nearest half deck) for the <b>true count</b>, then{' '}
          {tcMethod === 'round' ? 'round it' : tcMethod === 'floor' ? 'round it down' : 'drop the fraction'} ({TC_METHOD_NAME[tcMethod]}, set in Settings).
        </p>
        <p>
          At or above an index, make the index play instead of basic strategy. The <span className="dev-dir dev-dir-lt">below</span> plays are the reverse: stand as usual, but hit once the count
          falls under the index.
        </p>
        <p className="faint">Multi-deck Hi-Lo indices. The Smart trainer grades these when “Index plays” is on.</p>
      </section>

      <DevSection title="Illustrious 18" sub="The eighteen most valuable index plays, in order of value" items={i18} rules={rules} />
      <DevSection
        title="Fab 4 surrenders"
        sub={rules.surrender ? 'When late surrender is offered' : 'Only with late surrender — off in these rules'}
        items={fab}
        rules={rules}
        dim={!rules.surrender}
        start={i18.length}
      />
    </div>
  );
}

function DevSection({ title, sub, items, rules, dim, start = 0 }: { title: string; sub: string; items: Deviation[]; rules: Rules; dim?: boolean; start?: number }) {
  return (
    <section className={`panel dev-section${dim ? ' is-dim' : ''}`}>
      <div className="dev-section-head">
        <h2>{title}</h2>
        <span className="muted">{sub}</span>
      </div>
      <div className="dev-table" role="table" aria-label={title}>
        <div className="dev-row dev-head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Hand</span>
          <span role="columnheader">Index</span>
          <span role="columnheader">Basic → Index play</span>
          <span role="columnheader" className="dev-rule-h">
            When
          </span>
        </div>
        {items.map((d, i) => {
          const hand = d.kind === 'insurance' ? 'Insurance' : d.label.split(' vs ')[0];
          const off = (d.kind === 'insurance' && !rules.insurance) || (d.set === 'Fab4' && !rules.surrender) || (d.action === 'D' && !rules.double) || (d.action === 'P' && !rules.split);
          return (
            <div key={d.id} className={`dev-row${off ? ' is-off' : ''}`} role="row" style={{ '--i': i } as CSSProperties}>
              <span className="dev-n" role="cell">
                {start + i + 1}
              </span>
              <span className="dev-hand" role="cell">
                <b>{hand}</b> <span className="muted">vs {d.up}</span>
              </span>
              <span role="cell">
                <span className={`dev-index${d.index > 0 ? ' is-pos' : d.index < 0 ? ' is-neg' : ''}`}>{tcLabel(d.index)}</span>
              </span>
              <span className="dev-plays" role="cell">
                {d.basic === 'No ins' ? <span className="act act-none">No</span> : <ActionPill a={d.basic} />}
                <svg className="dev-arrow" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                {d.action === 'Ins' ? <span className="act act-ins">Ins</span> : <ActionPill a={d.action} />}
                <span className="dev-sr">
                  {d.basic === 'No ins' ? 'No insurance' : ACTION_NAME[d.basic]} becomes {d.action === 'Ins' ? 'take insurance' : ACTION_NAME[d.action]}
                </span>
              </span>
              <span className="dev-rule" role="cell">
                <span className={`dev-dir dev-dir-${d.dir}`}>{d.dir === 'ge' ? '≥' : '<'}</span> {deviationRule(d)}
                {d.kind === 'insurance' && <span className="faint"> · when insurance is offered</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
