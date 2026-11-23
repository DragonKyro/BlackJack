// The Bet trainer and the Smart trainer's table: count + bet before each
// round, graded; then the round plays (itself, or by you in Smart).

import { useEffect, useState, type CSSProperties } from 'react';
import { rulesSummary } from '@/bj/rules';
import { remaining, totalCards } from '@/bj/shoe';
import { hand, legal, upCard } from '@/bj/table';
import { isNatural } from '@/bj/hand';
import { spreadName } from '@/math/betSpread';
import { useConfig } from '@/store/configStore';
import { useCountBet, type CbKind } from '@/store/countBetStore';
import { paceMs, usePrefs } from '@/store/prefsStore';
import { useStats } from '@/store/statsStore';
import type { Action } from '@/strategy/tables';
import { go, paths } from '../router';
import { TopBar, useHotkeys } from '../shared/controls';
import { Entry } from '../shared/Entry';
import { Icon } from '../shared/Icon';
import { StrategyPeek } from '../shared/StrategyPeek';
import { ActionBar, ruleActions } from '../table/ActionBar';
import { BetCheck, CountCheck } from '../table/Checks';
import { Discard, Felt, Shoe } from '../table/Felt';
import { DealerArea } from '../table/Hands';
import { Seats, seatCardWidth } from '../table/Seats';
import { spreadFor } from './Setup';

function Score({ label, ok, n }: { label: string; ok: number; n: number }) {
  const p = n ? ok / n : 0;
  return (
    <span className={`score${!n ? '' : p >= 0.9 ? ' is-good' : p >= 0.7 ? ' is-mid' : ' is-bad'}`} title={`${ok} of ${n}`}>
      <b>{n ? `${Math.round(p * 100)}%` : '—'}</b>
      <span>{label}</span>
    </span>
  );
}

export function CountBetPage({ kind }: { kind: CbKind }) {
  const cfg = useConfig((s) => (kind === 'bet' ? s.bet : s.smart));
  const saved = useStats((s) => s.spread);
  const c = useCountBet();
  const speed = usePrefs((s) => s.speed);
  const [peek, setPeek] = useState(false);
  const setup = paths.setup(kind);

  useEffect(() => {
    useCountBet.getState().start(kind, cfg, spreadFor(cfg.spread, saved?.units));
    return () => useCountBet.getState().leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = c.table;
  const smart = kind === 'smart';
  const rules = t?.rules ?? cfg.rules;
  const myTurn = c.phase === 'turn';
  const legalNow: Action[] = t && myTurn ? legal(t) : [];

  useHotkeys(
    {
      Escape: () => (peek ? setPeek(false) : go(setup)),
      Enter: () => (c.phase === 'feedback' ? c.proceed() : c.phase === 'result' ? c.next() : undefined),
      ' ': () => (c.phase === 'feedback' ? c.proceed() : c.phase === 'result' ? c.next() : undefined),
      h: () => c.act('H'),
      s: () => c.act('S'),
      d: () => c.act('D'),
      p: () => c.act('P'),
      r: () => c.act('R'),
      y: () => c.insure(true),
      n: () => c.insure(false),
      t: () => smart && setPeek(true),
    },
    c.phase !== 'betting' && !peek,
  );
  useHotkeys({ Escape: () => go(setup) }, c.phase === 'betting');

  if (!t || !c.spread) return null;
  const n = t.seats.length;
  const flight = c.speedMs ? Math.min(paceMs(speed).flight, c.speedMs * 0.9) : undefined;
  const askLabel = c.ask === 'rc' ? 'Running count' : 'True count';
  const myCards = hand(t)?.cards;
  const youBj = c.phase === 'insurance' && isNatural(t.seats[c.you]!.hands[0]?.cards ?? []);

  return (
    <div className="table-page" style={{ '--cw-seat': seatCardWidth(n), ...(n > 1 ? { '--cw': 'clamp(48px, min(14.5vw, 10dvh), 96px)' } : {}) } as CSSProperties}>
      <TopBar
        title={smart ? 'Smart Trainer' : 'Bet Trainer'}
        sub={`${rulesSummary(rules)} · ${spreadName(c.spread)}`}
        backTo={setup}
        right={
          <span className="scores">
            <Score label={c.ask === 'rc' ? 'RC' : 'TC'} ok={c.checksOk} n={c.checks} />
            <Score label="bets" ok={c.betsOk} n={c.bets} />
            {smart && <Score label="play" ok={c.playsOk} n={c.plays} />}
            <span className="score score-net">
              <b className={c.net > 0 ? 'pos' : c.net < 0 ? 'neg' : ''}>
                {c.net > 0 ? '+' : c.net < 0 ? '−' : ''}
                {Math.abs(c.net)}u
              </b>
              <span>net</span>
            </span>
          </span>
        }
      />
      <Felt rules={rules} className={n > 1 ? 'has-arc' : ''}>
        <Discard count={t.discards} total={totalCards(t.shoe)} />
        <Shoe remaining={remaining(t.shoe)} total={totalCards(t.shoe)} cut={t.shoe.cut} showNumbers={cfg.showDecks} />
        <DealerArea cards={t.dealer} holeUp={t.holeUp} sweep={c.sweep} peeking={t.phase === 'peek'} flightMs={flight} />
        {c.note && (
          <span key={c.note.id} className={`play-note ${c.note.ok ? 'ok' : 'bad'}`}>
            {c.note.text}
          </span>
        )}
        <div className="quiz-layer">
          {c.phase === 'betting' && (
            <Entry
              key={`${t.round}-${t.shoe.gen}`}
              title={
                <>
                  Count and bet
                  <small>
                    {c.ask === 'rc' ? 'Running count of the cards seen' : 'True count: RC ÷ decks left'} · bet in units (0 to sit out)
                  </small>
                </>
              }
              fields={[
                { key: 'count', label: askLabel, signed: true },
                { key: 'bet', label: 'Bet', signed: false, suffix: 'u' },
              ]}
              onSubmit={(v) => c.submit(v.count!, v.bet!)}
              submitLabel="Bet"
            />
          )}
          {c.phase === 'feedback' && c.count && c.bet && (
            <div className="checks">
              <CountCheck g={c.count} />
              <BetCheck g={c.bet} tc={c.count.tc} />
              <button type="button" className="btn" onClick={() => c.proceed()}>
                Deal <kbd>Enter</kbd>
              </button>
            </div>
          )}
          {c.phase === 'shuffle' && (
            <div className="felt-msg">
              <Icon name="shuffle" /> New shoe
              <small>Shuffled — the count starts again at 0.</small>
            </div>
          )}
          {c.phase === 'insurance' && (
            <div className="felt-msg">
              {youBj ? 'Even money?' : 'Insurance?'}
              <small>{c.indexPlays ? 'Index play: insure at TC +3 or more' : 'Pays 2 to 1'}</small>
            </div>
          )}
          {c.phase === 'running' && c.ghost && (
            <div className="felt-msg">
              Sitting out
              <small>Watching a round to keep the count going.</small>
            </div>
          )}
        </div>
        <Seats table={t} you={c.you} sweep={c.sweep} showResults={c.phase === 'result'} units flightMs={flight} names={(i) => (i === c.you ? (c.ghost ? 'You (out)' : 'You') : `P${i + 1}`)} />
      </Felt>
      <div className="dock">
        {smart && (c.phase === 'turn' || c.phase === 'running') ? (
          <>
            <ActionBar legal={legalNow} shown={ruleActions(rules)} onAct={(a) => c.act(a)} disabled={!myTurn} />
            <div className="dock-hint">
              <span>{myTurn ? 'Your play' : 'Dealing…'}</span>
              <span>
                <kbd>T</kbd> chart
              </span>
            </div>
          </>
        ) : c.phase === 'insurance' ? (
          <div className="dock-row">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => c.insure(false)}>
              No <kbd>N</kbd>
            </button>
            <button type="button" className="btn btn-lg" onClick={() => c.insure(true)}>
              {youBj ? 'Even money' : 'Insure'} <kbd>Y</kbd>
            </button>
          </div>
        ) : c.phase === 'result' && smart ? (
          <div className="dock-row">
            <button type="button" className="btn btn-lg btn-shine" onClick={() => c.next()}>
              Next round <Icon name="arrow" size="sm" />
            </button>
          </div>
        ) : (
          <div className="dock-hint">
            {c.phase === 'betting' ? (
              <>
                <span>
                  <kbd>0–9</kbd>
                  <kbd>−</kbd> type
                </span>
                <span>
                  <kbd>Tab</kbd> count ↔ bet
                </span>
                <span>
                  <kbd>Enter</kbd> bet
                </span>
              </>
            ) : (
              <span>{c.phase === 'feedback' ? 'Enter to deal' : 'The hands play basic strategy — keep counting'}</span>
            )}
          </div>
        )}
      </div>
      {peek && <StrategyPeek rules={rules} cards={myCards} up={upCard(t)} onClose={() => setPeek(false)} />}
    </div>
  );
}
