// Counting trainer: a full table deals itself; keep the running count.
// Keys: digits / − / Enter to answer, Enter or Space to continue, Space to
// pause, Esc back.

import { useEffect, type CSSProperties } from 'react';
import { remaining, totalCards } from '@/bj/shoe';
import { useConfig } from '@/store/configStore';
import { useCounting } from '@/store/countingStore';
import { paceMs, usePrefs } from '@/store/prefsStore';
import { go, paths } from '../router';
import { TopBar, signed, useHotkeys } from '../shared/controls';
import { Entry } from '../shared/Entry';
import { Icon } from '../shared/Icon';
import { Discard, Felt, Shoe } from '../table/Felt';
import { DealerArea } from '../table/Hands';
import { Seats, seatCardWidth } from '../table/Seats';

function Score({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className={`score${tone ? ` ${tone}` : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </span>
  );
}

export function CountingTrainer() {
  const cfg = useConfig((s) => s.counting);
  const c = useCounting();
  const speed = usePrefs((s) => s.speed);

  useEffect(() => {
    useCounting.getState().start(cfg);
    return () => useCounting.getState().leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHotkeys(
    {
      Escape: () => go(paths.setup('counting')),
      ' ': () => (c.phase === 'answer' ? c.proceed() : c.togglePause()),
      Enter: () => c.phase === 'answer' && c.proceed(),
    },
    c.phase !== 'quiz',
  );
  useHotkeys({ Escape: () => go(paths.setup('counting')) }, c.phase === 'quiz');

  const t = c.table;
  if (!t || !c.cfg) return null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const tone = (a: number, b: number) => (!b ? undefined : a / b >= 0.9 ? 'is-good' : a / b >= 0.7 ? 'is-mid' : 'is-bad');
  const flight = Math.min(paceMs(speed).flight, c.cfg.speed * 900);
  const n = t.seats.length;
  const last = c.last;

  return (
    <div className="table-page" style={{ '--cw-seat': seatCardWidth(n), '--cw': 'clamp(46px, min(14vw, 9.6dvh), 92px)' } as CSSProperties}>
      <TopBar
        title="Counting Trainer"
        sub={`${c.cfg.decks} decks · ${n} seats · ${c.cfg.speed.toFixed(1)} s/card`}
        backTo={paths.setup('counting')}
        right={
          <span className="scores">
            <Score label="exact" value={pct(c.exact, c.polls)} tone={tone(c.exact, c.polls)} />
            <Score label="±1" value={pct(c.close, c.polls)} tone={tone(c.close, c.polls)} />
            <Score label="checks" value={String(c.polls)} />
          </span>
        }
      />
      <Felt rules={t.rules} className="has-arc">
        <Discard count={t.discards} total={totalCards(t.shoe)} />
        <Shoe remaining={remaining(t.shoe)} total={totalCards(t.shoe)} cut={t.shoe.cut} />
        <DealerArea cards={t.dealer} holeUp={t.holeUp} sweep={c.sweep} flightMs={flight} totals={false} />
        <Seats table={t} you={-1} sweep={c.sweep} showResults={false} flightMs={flight} names={(i) => `Seat ${i + 1}`} bare />
        {c.phase === 'paused' && <div className="paused">PAUSED</div>}
        {c.phase === 'shuffle' && (
          <div className="quiz-backdrop">
            <div className="felt-msg">
              <Icon name="shuffle" /> New shoe
              <small>Shuffled — the count starts again at 0.</small>
            </div>
          </div>
        )}
        {c.phase === 'quiz' && (
          <div className="quiz-backdrop">
            <Entry
              title={
                <>
                  What’s the running count?
                  <small>{c.cards} cards seen this session</small>
                </>
              }
              fields={[{ key: 'rc', label: 'Running count', signed: true }]}
              onSubmit={(v) => c.answer(v.rc!)}
              submitLabel="Check"
            />
          </div>
        )}
        {c.phase === 'answer' && last && (
          <div className="quiz-backdrop" onClick={() => c.proceed()}>
            <div className={`felt-msg quiz-result ${last.diff === 0 ? 'ok' : last.diff === 1 ? 'close' : 'bad'}`}>
              <div className="big">{signed(last.actual)}</div>
              {last.diff === 0 ? 'Correct!' : last.diff === 1 ? `Close — you said ${signed(last.guess)}` : `You said ${signed(last.guess)} (off by ${last.diff})`}
              <small>Enter or Space to continue</small>
            </div>
          </div>
        )}
      </Felt>
      <div className="dock">
        <div className="counting-foot">
          <button type="button" className="btn btn-ghost" onClick={() => (c.phase === 'answer' ? c.proceed() : c.togglePause())} disabled={c.phase === 'quiz' || c.phase === 'shuffle'}>
            <Icon name={c.phase === 'paused' ? 'play' : c.phase === 'answer' ? 'arrow' : 'pause'} size="sm" /> {c.phase === 'paused' ? 'Resume' : c.phase === 'answer' ? 'Continue' : 'Pause'}
          </button>
          <span className="faint">
            Asked every {c.cfg.pollEvery} cards · {c.polls ? `avg error ${(c.absErr / c.polls).toFixed(2)}` : 'Hi-Lo: 2–6 +1 · 7–9 0 · 10–A −1'}
          </span>
        </div>
        <div className="dock-hint">
          <span>
            <kbd>Space</kbd> pause
          </span>
          <span>
            <kbd>Esc</kbd> back
          </span>
        </div>
      </div>
    </div>
  );
}
