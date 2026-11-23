// Play Blackjack: the table, your bankroll and chips, the play buttons.
// Keys — betting: Enter deal, ←/→ bet −/+ a minimum, C clear; playing:
// H S D P R; insurance: Y / N; result: Enter or Space next hand; T strategy
// chart; Esc back.

import { useEffect, useState, type CSSProperties } from 'react';
import { rulesSummary } from '@/bj/rules';
import { remaining, totalCards } from '@/bj/shoe';
import { hand, legal, upCard } from '@/bj/table';
import { isNatural } from '@/bj/hand';
import { useConfig } from '@/store/configStore';
import { usePlay } from '@/store/playStore';
import type { Action } from '@/strategy/tables';
import { formatMoney } from '../chips/chipArt';
import { go, paths } from '../router';
import { TopBar, useHotkeys, useTween } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { StrategyPeek } from '../shared/StrategyPeek';
import { ActionBar, ruleActions } from '../table/ActionBar';
import { ChipRack } from '../table/Chips';
import { CountChip } from '../table/CountChip';
import { Discard, Felt, Shoe } from '../table/Felt';
import { DealerArea } from '../table/Hands';
import { Seats, seatCardWidth } from '../table/Seats';

export function PlayPage() {
  const cfg = useConfig((s) => s.play);
  const p = usePlay();
  const [peek, setPeek] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    p.start(cfg);
    return () => usePlay.getState().leave();
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!p.shuffles) return;
    setToast('New shoe — shuffled');
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [p.shuffles]);

  useEffect(() => {
    if (!p.coach) return;
    setToast(p.coach.text);
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [p.coach]);

  const t = p.table;
  const rules = t?.rules ?? cfg.rules;
  const min = rules.minBet;
  const myHand = t ? hand(t) : null;
  const myTurn = p.stage === 'turn' && t?.turn?.seat === p.you;
  const legalNow: Action[] = t && myTurn ? legal(t, p.bankroll) : [];
  const broke = p.stage === 'betting' && p.bankroll < min;
  const bankroll = useTween(p.bankroll);

  useHotkeys(
    {
      Escape: () => (peek ? setPeek(false) : go(paths.setup('play'))),
      t: () => setPeek((v) => !v),
      Enter: () => (p.stage === 'betting' ? p.deal() : p.stage === 'result' ? p.next() : undefined),
      ' ': () => (p.stage === 'result' ? p.next() : undefined),
      ArrowLeft: () => p.setBet(p.bet - min),
      ArrowRight: () => p.setBet(p.bet + min),
      c: () => p.clearBet(),
      h: () => p.act('H'),
      s: () => p.act('S'),
      d: () => p.act('D'),
      p: () => p.act('P'),
      r: () => p.act('R'),
      y: () => p.insure(true),
      n: () => p.insure(false),
    },
    !peek,
  );

  if (!t) return null;
  const n = t.seats.length;
  const youHaveBj = p.stage === 'insurance' && isNatural(t.seats[p.you]!.hands[0]?.cards ?? []);

  return (
    <div className="table-page" style={{ '--cw-seat': seatCardWidth(n) } as CSSProperties}>
      <TopBar
        title="Blackjack"
        sub={rulesSummary(rules)}
        backTo={paths.setup('play')}
        right={
          <>
            {cfg.showCount && <CountChip table={t} />}
            <button type="button" className="icon-btn" onClick={() => setPeek(true)} aria-label="Strategy chart (T)" title="Strategy chart (T)">
              <Icon name="grid" />
            </button>
          </>
        }
      />
      <Felt rules={rules} className={n > 1 ? 'has-arc' : ''}>
        <Discard count={t.discards} total={totalCards(t.shoe)} />
        <Shoe remaining={remaining(t.shoe)} total={totalCards(t.shoe)} cut={t.shoe.cut} />
        <DealerArea cards={t.dealer} holeUp={t.holeUp} sweep={p.sweep} peeking={t.phase === 'peek'} />
        <div className="felt-mid">
          {p.stage === 'insurance' && (
            <div className="felt-msg">
              {youHaveBj ? 'Even money?' : 'Insurance?'}
              <small>{youHaveBj ? 'Take 1:1 now on your blackjack' : `Costs ${formatMoney((t.seats[p.you]!.hands[0]?.bet ?? 0) / 2)} · pays 2 to 1`}</small>
            </div>
          )}
          {p.stage === 'result' && p.roundNet !== null && (
            <div className="felt-msg" key={t.round}>
              <span className={`round-net ${p.roundNet > 0 ? 'pos' : p.roundNet < 0 ? 'neg' : ''}`}>{p.roundNet === 0 ? 'Push' : formatMoney(p.roundNet, true)}</span>
            </div>
          )}
          {broke && (
            <div className="felt-msg">
              Out of chips
              <small>Your bankroll is below the table minimum.</small>
            </div>
          )}
        </div>
        <Seats table={t} you={p.you} sweep={p.sweep} showResults={p.stage === 'result'} pendingBet={p.stage === 'betting' ? p.bet : undefined} names={(i) => (i === p.you ? 'You' : n > 1 ? `P${i + 1}` : undefined)} />
      </Felt>

      <div className="dock">
        {p.stage === 'betting' ? (
          <>
            <div className="dock-row">
              <span className="bankroll">
                <span className="bankroll-label">Bankroll</span>
                <span className="bankroll-value">{formatMoney(Math.round(bankroll * 100) / 100)}</span>
              </span>
              <ChipRack bankroll={p.bankroll - p.bet} onChip={(d) => p.addChip(d)} />
            </div>
            <div className="dock-row">
              {broke ? (
                <button type="button" className="btn btn-lg btn-shine" onClick={() => p.rebuy()}>
                  Rebuy {formatMoney(1000)}
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost" onClick={() => p.clearBet()} disabled={p.bet === 0}>
                    Clear
                  </button>
                  <button type="button" className="btn btn-lg btn-shine" onClick={() => p.deal()} disabled={p.bet < min || p.bet > p.bankroll}>
                    Deal {p.bet > 0 ? formatMoney(p.bet) : ''}
                  </button>
                </>
              )}
            </div>
            <div className="dock-hint">
              <span>
                <kbd>Enter</kbd> deal
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> bet ±{formatMoney(min)}
              </span>
              <span>Min {formatMoney(min)}</span>
            </div>
          </>
        ) : p.stage === 'insurance' ? (
          <div className="dock-row">
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => p.insure(false)}>
              No <kbd>N</kbd>
            </button>
            <button type="button" className="btn btn-lg" onClick={() => p.insure(true)}>
              {youHaveBj ? 'Even money' : 'Insure'} <kbd>Y</kbd>
            </button>
          </div>
        ) : p.stage === 'result' || p.stage === 'sweeping' ? (
          <>
            <div className="dock-row">
              <span className="bankroll">
                <span className="bankroll-label">Bankroll</span>
                <span className="bankroll-value">{formatMoney(Math.round(bankroll * 100) / 100)}</span>
              </span>
              <button type="button" className="btn btn-lg btn-shine" onClick={() => p.next()} disabled={p.stage === 'sweeping'}>
                Next hand <Icon name="arrow" size="sm" />
              </button>
            </div>
            <div className="dock-hint">
              <span>
                <kbd>Enter</kbd> next hand
              </span>
            </div>
          </>
        ) : (
          <>
            <ActionBar legal={legalNow} shown={ruleActions(rules)} onAct={(a) => p.act(a)} disabled={!myTurn} />
            <div className="dock-hint">
              <span>{myHand && myTurn ? `Your hand${t.seats[p.you]!.hands.length > 1 ? ` ${t.turn!.hand + 1} of ${t.seats[p.you]!.hands.length}` : ''}` : 'Dealing…'}</span>
              <span>
                <kbd>T</kbd> chart
              </span>
            </div>
          </>
        )}
      </div>
      {toast && (
        <div className="toast" key={toast}>
          {toast}
        </div>
      )}
      {peek && <StrategyPeek rules={rules} cards={myHand?.cards} up={upCard(t)} onClose={() => setPeek(false)} />}
    </div>
  );
}
