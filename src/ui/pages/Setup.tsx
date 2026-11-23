// Each mode's setup: its rules and options (remembered), then Start.

import type { CSSProperties, ReactNode } from 'react';
import { DECK_OPTIONS } from '@/bj/rules';
import { PRESETS, TCS, betFor, type Spread } from '@/math/betSpread';
import { summarize } from '@/math/analytics';
import { useConfig, type CountAsk, type SpreadId } from '@/store/configStore';
import { START_BANKROLL, useStats } from '@/store/statsStore';
import { DEAL_MODES, type DealMode } from '@/strategy/deal';
import { formatMoney } from '../chips/chipArt';
import { go, paths, type Mode } from '../router';
import { Cycle, Row, Segmented, Toggle, TopBar, useHotkeys } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { RulesEditor } from '../shared/RulesEditor';
import { MODE_INFO } from './modes';

export const SEAT_SPEEDS = [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0] as const;
export const POLL_OPTIONS = [5, 10, 15, 20, 30, 52] as const;

/** The spread a trainer uses: a preset or your saved one. */
export function spreadFor(id: SpreadId, saved: Spread | undefined): Spread {
  if (id === 'mine' && saved) return saved;
  return (PRESETS[id === 'mine' ? '1-12' : id] ?? PRESETS['1-12']!).spread;
}

export function SpreadBars({ spread }: { spread: Spread }) {
  const max = Math.max(1, ...TCS.map((tc) => betFor(spread, tc)));
  return (
    <span className="spread-mini" aria-hidden>
      {TCS.filter((tc) => tc >= -3 && tc <= 7).map((tc) => {
        const b = betFor(spread, tc);
        return <i key={tc} className={b === 0 ? 'zero' : ''} style={{ height: `${(b / max) * 100}%` }} />;
      })}
    </span>
  );
}

function SpreadPicker({ value, onChange }: { value: SpreadId; onChange: (v: SpreadId) => void }) {
  const saved = useStats((s) => s.spread);
  const ids: SpreadId[] = ['1-12', '1-8', '1-4', 'flat', ...(saved ? (['mine'] as SpreadId[]) : [])];
  return (
    <>
      <Row label="Bet spread" hint={saved ? 'Units by true count · "Mine" is the one saved in the analyzer' : 'Units by true count · save your own in the Bet Spread Analyzer'}>
        <Segmented<SpreadId> label="Bet spread" value={ids.includes(value) ? value : '1-12'} onChange={onChange} options={ids.map((id) => ({ value: id, label: id === 'mine' ? 'Mine' : PRESETS[id]!.name }))} />
      </Row>
      <div className="spread-preview">
        <SpreadBars spread={spreadFor(value, saved?.units)} />
        <span className="faint">TC −3 … +7</span>
      </div>
    </>
  );
}

function AskPicker({ value, onChange }: { value: CountAsk; onChange: (v: CountAsk) => void }) {
  return (
    <Row label="Count check" hint={value === 'tc' ? 'Give the true count (running count ÷ decks left)' : 'Give the running count (easier)'}>
      <Segmented<CountAsk>
        label="Count check"
        value={value}
        onChange={onChange}
        options={[
          { value: 'tc', label: 'True count' },
          { value: 'rc', label: 'Running count' },
        ]}
      />
    </Row>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="setup-panel panel">
      {title && <div className="section-h">{title}</div>}
      {children}
    </section>
  );
}

export function SetupPage({ mode }: { mode: Mode }) {
  const cfg = useConfig();
  const info = MODE_INFO[mode];
  const start = () => go(paths.go(mode));
  useHotkeys({ Enter: start, Escape: () => go(paths.home) });

  return (
    <div className="page">
      <TopBar title={info.name} sub="Setup" backTo={paths.home} />
      <div className="setup-hero">
        <span className={`mode-badge ${info.tone}`}>
          <Icon name={info.icon} />
        </span>
        <p>{info.blurb}</p>
      </div>

      {mode === 'play' && <PlaySetup />}
      {mode === 'strategy' && <StrategySetup />}
      {mode === 'counting' && (
        <Panel title="Table">
          <Row label="Decks">
            <Cycle label="decks" value={cfg.counting.decks} options={DECK_OPTIONS} onChange={(decks) => cfg.update('counting', { decks })} clamp />
          </Row>
          <Row label="Seats" hint="Players at the table">
            <Cycle label="seats" value={cfg.counting.seats} options={[1, 2, 3, 4, 5, 6, 7]} onChange={(seats) => cfg.update('counting', { seats })} clamp />
          </Row>
          <Row label="Deal speed" hint="Seconds per card">
            <Cycle label="deal speed" value={cfg.counting.speed} options={SEAT_SPEEDS} onChange={(speed) => cfg.update('counting', { speed })} format={(v) => `${v.toFixed(1)} s`} clamp />
          </Row>
          <Row label="Ask every" hint="Cards between count checks">
            <Cycle label="ask every" value={cfg.counting.pollEvery} options={POLL_OPTIONS} onChange={(pollEvery) => cfg.update('counting', { pollEvery })} format={(v) => `${v} cards`} clamp />
          </Row>
        </Panel>
      )}
      {mode === 'bet' && (
        <>
          <Panel title="Training">
            <Row label="Seats" hint="Including yours (the hands play basic strategy)">
              <Cycle label="seats" value={cfg.bet.seats} options={[1, 2, 3, 4, 5]} onChange={(seats) => cfg.update('bet', { seats })} clamp />
            </Row>
            <Row label="Deal speed" hint="Seconds per card">
              <Cycle label="deal speed" value={cfg.bet.speed} options={SEAT_SPEEDS} onChange={(speed) => cfg.update('bet', { speed })} format={(v) => `${v.toFixed(1)} s`} clamp />
            </Row>
            <AskPicker value={cfg.bet.ask} onChange={(ask) => cfg.update('bet', { ask })} />
            <SpreadPicker value={cfg.bet.spread} onChange={(spread) => cfg.update('bet', { spread })} />
            <Row label="Show decks left" hint="Otherwise judge it from the discard tray">
              <Toggle label="Show decks left" on={cfg.bet.showDecks} onChange={(showDecks) => cfg.update('bet', { showDecks })} />
            </Row>
          </Panel>
          <Panel title="Rules">
            <RulesEditor rules={cfg.bet.rules} onChange={(rules) => cfg.update('bet', { rules })} show={{ insurance: false }} />
          </Panel>
        </>
      )}
      {mode === 'smart' && (
        <>
          <Panel title="Training">
            <AskPicker value={cfg.smart.ask} onChange={(ask) => cfg.update('smart', { ask })} />
            <SpreadPicker value={cfg.smart.spread} onChange={(spread) => cfg.update('smart', { spread })} />
            <Row label="Index plays" hint="Grade plays by the Illustrious 18 + Fab 4 at the true count">
              <Toggle label="Index plays" on={cfg.smart.indexPlays} onChange={(indexPlays) => cfg.update('smart', { indexPlays })} />
            </Row>
            <Row label="Other players" hint="More cards to count each round">
              <Cycle label="other players" value={cfg.smart.others} options={[0, 1, 2, 3]} onChange={(others) => cfg.update('smart', { others })} clamp />
            </Row>
            <Row label="Show decks left" hint="Otherwise judge it from the discard tray">
              <Toggle label="Show decks left" on={cfg.smart.showDecks} onChange={(showDecks) => cfg.update('smart', { showDecks })} />
            </Row>
          </Panel>
          <Panel title="Rules">
            <RulesEditor rules={cfg.smart.rules} onChange={(rules) => cfg.update('smart', { rules })} show={{ insurance: false }} />
          </Panel>
        </>
      )}

      <div className="setup-keys">
        <Icon name="keyboard" size="sm" />
        {info.keys.map(([k, what]) => (
          <span key={k}>
            <kbd>{k}</kbd> {what}
          </span>
        ))}
      </div>
      <div className="setup-go">
        <button type="button" className="btn btn-lg btn-shine" onClick={start}>
          <Icon name="play" size="sm" /> Start
        </button>
      </div>
    </div>
  );
}

function PlaySetup() {
  const cfg = useConfig();
  const play = useStats((s) => s.play);
  const setPlay = useStats((s) => s.setPlay);
  return (
    <>
      <Panel title="Your seat">
        <Row label="Bankroll" hint={`${play.hands} hands · ${formatMoney(play.net, true)} lifetime`}>
          <span className="setup-bankroll">
            <b>{formatMoney(play.bankroll)}</b>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlay({ bankroll: START_BANKROLL, rebuys: play.rebuys + 1 })} disabled={play.bankroll === START_BANKROLL}>
              Reset to {formatMoney(START_BANKROLL)}
            </button>
          </span>
        </Row>
        <Row label="Other players" hint="They play basic strategy — more cards to count">
          <Cycle label="other players" value={cfg.play.others} options={[0, 1, 2, 3, 4]} onChange={(others) => cfg.update('play', { others })} clamp />
        </Row>
        <Row label="Coach" hint="Flags plays that differ from basic strategy">
          <Toggle label="Coach" on={cfg.play.coach} onChange={(coach) => cfg.update('play', { coach })} />
        </Row>
        <Row label="Show the count" hint="Running and true count in the top bar">
          <Toggle label="Show the count" on={cfg.play.showCount} onChange={(showCount) => cfg.update('play', { showCount })} />
        </Row>
      </Panel>
      <Panel title="Table rules">
        <RulesEditor rules={cfg.play.rules} onChange={(rules) => cfg.update('play', { rules })} show={{ minBet: true }} />
      </Panel>
    </>
  );
}

function StrategySetup() {
  const cfg = useConfig();
  const drills = useStats((s) => s.drills);
  const s = summarize(drills.filter((d) => d.mode === 'strategy'));
  return (
    <>
      <Panel title="Deal">
        <div className="deal-modes">
          {DEAL_MODES.map((m, i) => (
            <button key={m.id} type="button" className={`deal-mode${cfg.strategy.mode === m.id ? ' is-on' : ''}`} style={{ '--k': i } as CSSProperties} onClick={() => cfg.update('strategy', { mode: m.id as DealMode })} disabled={m.id === 'pairs' && !cfg.strategy.rules.split}>
              <b>{m.name}</b>
              <span>{m.hint}</span>
            </button>
          ))}
        </div>
        {s.total > 0 && (
          <p className="setup-note faint">
            Lifetime: {s.correct} / {s.total} right ({Math.round(s.pct)}%) · last 50: {Math.round(s.last50)}%
          </p>
        )}
      </Panel>
      <Panel title="Rules">
        <RulesEditor rules={cfg.strategy.rules} onChange={(rules) => cfg.update('strategy', { rules })} show={{ decks: false, penetration: false, insurance: false }} />
      </Panel>
    </>
  );
}
