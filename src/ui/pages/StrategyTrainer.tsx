// Strategy trainer: a hand and the dealer's up card; pick the play.
// Keys: H S D P R; any key (or tap) for the next hand; T chart; Esc back.

import { useEffect, useState, type CSSProperties } from 'react';
import { upCol } from '@/bj/cards';
import { rulesSummary } from '@/bj/rules';
import { summarize } from '@/math/analytics';
import { useConfig } from '@/store/configStore';
import { usePrefs } from '@/store/prefsStore';
import { FEEDBACK_MS, useStrategy } from '@/store/strategyStore';
import { useStats } from '@/store/statsStore';
import { DEAL_MODES, type DealMode } from '@/strategy/deal';
import { ACTION_NAME, rowLabel, type Action, type HandType } from '@/strategy/tables';
import { go, paths } from '../router';
import { Segmented, TopBar, useHotkeys } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { StrategyPeek } from '../shared/StrategyPeek';
import { ActionBar, ruleActions } from '../table/ActionBar';
import { Felt } from '../table/Felt';
import { CardRow, TotalBadge } from '../table/Hands';
import { setAnchor } from '../table/anchors';

const TYPE_NAME: Record<HandType, string> = { hard: 'Hard', soft: 'Soft', pair: 'Pair' };

export function StrategyTrainer() {
  const cfg = useConfig((s) => s.strategy);
  const update = useConfig((s) => s.update);
  const s = useStrategy();
  const autoAdvance = usePrefs((p) => p.autoAdvance);
  const drills = useStats((x) => x.drills);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    useStrategy.getState().start(cfg.rules, cfg.mode);
    return () => useStrategy.getState().leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rules = s.rules ?? cfg.rules;
  const lifetime = summarize(drills.filter((d) => d.mode === 'strategy'));
  const shownActions = ruleActions(rules);
  const asking = s.phase === 'asking';

  const press = (a: Action) => {
    if (s.phase === 'feedback') s.next();
    else if (shownActions.includes(a)) s.choose(a);
  };
  useHotkeys(
    {
      h: () => press('H'),
      s: () => press('S'),
      d: () => press('D'),
      p: () => press('P'),
      r: () => press('R'),
      t: () => setPeek(true),
      Escape: () => go(paths.setup('strategy')),
      '*': () => s.phase === 'feedback' && s.next(),
    },
    !peek,
  );

  const spot = s.spot;
  const sweeping = s.phase === 'sweeping';
  const player = spot ? [spot.cards[0], spot.cards[1]].slice(0, s.shown >= 3 ? 2 : s.shown >= 1 ? 1 : 0) : [];
  const dealer = spot ? [spot.up, spot.hole].slice(0, s.shown >= 4 ? 2 : s.shown >= 2 ? 1 : 0) : [];
  const ok = s.chosen !== null && s.chosen === s.answer;
  const sessionPct = s.total ? Math.round((s.correct / s.total) * 100) : 0;

  return (
    <div className="table-page trainer-page">
      <TopBar
        title="Strategy Trainer"
        sub={rulesSummary(rules)}
        backTo={paths.setup('strategy')}
        right={
          <>
            <span className="score-chip" title="This session">
              <b>
                {s.correct}/{s.total}
              </b>
              <span>{s.total ? `${sessionPct}%` : 'session'}</span>
            </span>
            <button type="button" className="icon-btn" onClick={() => setPeek(true)} aria-label="Strategy chart (T)">
              <Icon name="grid" />
            </button>
          </>
        }
      />
      <Felt rules={rules} print={false}>
        <span className="trainer-shoe" ref={(el) => setAnchor('shoe', el)} aria-hidden />
        <span className="trainer-discard" ref={(el) => setAnchor('discard', el)} aria-hidden />
        <div className="dealer-area">
          <span className="seat-tag">Dealer</span>
          <div className="dealer-hand">
            <CardRow key={s.round} cards={dealer} hideFrom={1} sweep={sweeping} />
          </div>
          <span className="total-slot">{dealer.length > 0 && !sweeping && <span className="total">Shows {spot ? upCol(spot.up) : ''}</span>}</span>
        </div>
        <div className="felt-mid">
          {s.phase === 'feedback' && s.answer && s.cell && (
            <button type="button" className={`verdict ${ok ? 'is-right' : 'is-wrong'}`} key={s.round} onClick={() => s.next()}>
              <span className="verdict-icon">
                <Icon name={ok ? 'check' : 'x'} size="lg" />
              </span>
              <span className="verdict-text">
                <b>{ok ? 'Correct' : `${ACTION_NAME[s.answer]} is right`}</b>
                <small>
                  {TYPE_NAME[s.cell.type]} {rowLabel(s.cell.type, s.cell.row)} vs {spot ? upCol(spot.up) : ''}
                  {!ok && s.chosen ? ` · you chose ${ACTION_NAME[s.chosen]}` : ''}
                </small>
              </span>
              {autoAdvance && <span className="verdict-timer" style={{ '--ms': `${ok ? FEEDBACK_MS : FEEDBACK_MS + 900}ms` } as CSSProperties} />}
            </button>
          )}
          {s.streak >= 3 && s.phase !== 'feedback' && (
            <span className="streak" key={s.streak}>
              <Icon name="spark" size="sm" /> {s.streak} in a row
            </span>
          )}
        </div>
        <div className="seats">
          <div className="seat is-you">
            <div className="seat-hands">
              <div className={`hand${asking ? ' is-active' : ''}`}>
                <CardRow key={s.round} cards={player} sweep={sweeping} />
                <span className="total-slot">{player.length === 2 && !sweeping && <TotalBadge cards={player} />}</span>
              </div>
            </div>
            <span className="seat-name">{s.cell && player.length === 2 ? `${TYPE_NAME[s.cell.type]} ${rowLabel(s.cell.type, s.cell.row)}` : 'You'}</span>
          </div>
        </div>
      </Felt>
      <div className="dock">
        <ActionBar legal={asking ? shownActions : []} shown={shownActions} onAct={press} disabled={!asking} flash={s.phase === 'feedback' && s.answer ? { right: s.answer, wrong: ok ? undefined : s.chosen ?? undefined } : null} />
        <div className="dock-row trainer-modes">
          <Segmented<DealMode>
            label="Deal"
            value={s.mode}
            onChange={(m) => {
              s.setMode(m);
              update('strategy', { mode: m });
            }}
            options={DEAL_MODES.map((m) => ({ value: m.id, label: m.name, disabled: m.id === 'pairs' && !rules.split }))}
          />
          <span className="faint lifetime">
            Lifetime {lifetime.correct}/{lifetime.total}
            {s.best >= 3 ? ` · best streak ${s.best}` : ''}
          </span>
        </div>
      </div>
      {peek && <StrategyPeek rules={rules} cards={spot?.cards} up={spot?.up} onClose={() => setPeek(false)} />}
    </div>
  );
}
