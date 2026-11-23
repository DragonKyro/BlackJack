// The Bet trainer and the Smart trainer share a loop:
//   betting  — you give the count (true or running) and your bet in units
//   feedback — both are graded against the cards seen and the spread
//   the round — Bet: every seat (yours too) plays itself by basic strategy;
//               Smart: you play your hand, each play graded (basic strategy,
//               or the index plays at the current true count)
//   result   — then the cards are swept and you bet again.

import { create } from 'zustand';
import { upCol } from '@/bj/cards';
import { pastCut, type TcMethod } from '@/bj/shoe';
import { act, begin, clear, hand, insure, legal, newTable, options, seatNet, waitingOnHuman, type Table } from '@/bj/table';
import type { Spread } from '@/math/betSpread';
import { ACTION_NAME, bestAction, classify, indexAction, insuranceByCount, rowLabel, type Action } from '@/strategy/tables';
import { playSound } from '@/ui/sounds';
import type { BetConfig, CountAsk, SmartConfig } from './configStore';
import { countOf, gradeBet, gradeCount, type BetGrade, type CountGrade } from './countCheck';
import { createDriver, stepDelay } from './driver';
import { paceMs, usePrefs } from './prefsStore';
import { newId, useStats, type Session } from './statsStore';

export type CbKind = 'bet' | 'smart';
export type CbPhase = 'betting' | 'feedback' | 'running' | 'turn' | 'insurance' | 'result' | 'sweeping' | 'shuffle';

export interface PlayNote {
  id: number;
  ok: boolean;
  text: string;
}

interface Scores {
  rounds: number;
  checks: number;
  checksOk: number;
  checksClose: number;
  bets: number;
  betsOk: number;
  plays: number;
  playsOk: number;
  net: number;
}

const ZERO: Scores = { rounds: 0, checks: 0, checksOk: 0, checksClose: 0, bets: 0, betsOk: 0, plays: 0, playsOk: 0, net: 0 };

interface CbState extends Scores {
  kind: CbKind;
  table: Table | null;
  you: number;
  ask: CountAsk;
  indexPlays: boolean;
  speedMs: number | null;
  spread: Spread | null;
  phase: CbPhase;
  sweep: boolean;
  count: CountGrade | null;
  bet: BetGrade | null;
  /** You bet 0 with nobody else at the table: your seat plays itself so the cards keep coming. */
  ghost: boolean;
  note: PlayNote | null;
  roundNet: number | null;
  session: Session | null;
  start: (kind: CbKind, cfg: BetConfig | SmartConfig, spread: Spread) => void;
  submit: (count: number, bet: number) => void;
  proceed: () => void;
  act: (a: Action) => void;
  insure: (take: boolean) => void;
  next: () => void;
  leave: () => void;
}

let gen = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, f: () => void) => {
  const mine = gen;
  timers.push(setTimeout(() => mine === gen && f(), ms));
};
const cancel = () => {
  gen++;
  timers.forEach(clearTimeout);
  timers = [];
};
let noteId = 0;
const method = (): TcMethod => usePrefs.getState().tcMethod;

export const useCountBet = create<CbState>((set, get) => {
  const cardMs = () => get().speedMs ?? paceMs(usePrefs.getState().speed).card;

  const driver = createDriver({
    get: () => get().table!,
    set: (table) => set({ table }),
    delay: (step) => stepDelay(step, cardMs()),
    after: (step) => {
      if (step.kind === 'deal' || step.kind === 'dealerHit' || (step.kind === 'auto' && step.action !== 'S')) playSound('card');
      else if (step.kind === 'reveal') playSound('flip');
    },
    idle: (t) => {
      const w = waitingOnHuman(t);
      if (w === 'play') set({ phase: 'turn' });
      else if (w === 'insurance') set({ phase: 'insurance' });
      else if (t.phase === 'done') settled(t);
    },
  });

  function record() {
    const s = get().session;
    if (!s) return;
    const g = get();
    const n: Record<string, number> = { rounds: g.rounds, checks: g.checks, checksOk: g.checksOk, checksClose: g.checksClose, bets: g.bets, betsOk: g.betsOk, net: g.net, askRc: g.ask === 'rc' ? 1 : 0 };
    if (g.kind === 'smart') Object.assign(n, { plays: g.plays, playsOk: g.playsOk });
    const next = { ...s, end: Date.now(), n };
    set({ session: next });
    useStats.getState().putSession(next);
  }

  function settled(t: Table) {
    const { you, ghost, kind } = get();
    const seat = t.seats[you]!;
    const mine = !seat.out && !ghost;
    const net = mine ? seatNet(seat) : 0;
    set({ phase: 'result', roundNet: mine ? net : null, rounds: get().rounds + 1, net: get().net + net });
    if (mine) playSound(net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
    record();
    if (kind === 'bet') later(Math.max(1100, cardMs() * 2.2), () => get().next());
  }

  function note(ok: boolean, text: string) {
    set({ note: { id: ++noteId, ok, text } });
  }

  function grade(right: Action | 'Ins' | 'No', chosen: Action | 'Ins' | 'No', ctx: string) {
    const ok = right === chosen;
    set({ plays: get().plays + 1, playsOk: get().playsOk + (ok ? 1 : 0) });
    const name = (a: Action | 'Ins' | 'No') => (a === 'Ins' ? 'Insure' : a === 'No' ? 'No insurance' : ACTION_NAME[a]);
    note(ok, ok ? `${name(chosen)} ✓` : `${name(right)} was right · ${ctx}`);
    playSound(ok ? 'right' : 'wrong');
  }

  return {
    ...ZERO,
    kind: 'bet',
    table: null,
    you: 0,
    ask: 'tc',
    indexPlays: false,
    speedMs: null,
    spread: null,
    phase: 'betting',
    sweep: false,
    count: null,
    bet: null,
    ghost: false,
    note: null,
    roundNet: null,
    session: null,

    start: (kind, cfg, spread) => {
      cancel();
      driver.stop();
      const n = kind === 'bet' ? (cfg as BetConfig).seats : (cfg as SmartConfig).others + 1;
      const you = Math.floor(n / 2);
      const auto = Array.from({ length: n }, (_, i) => kind === 'bet' || i !== you);
      const rules = { ...cfg.rules, insurance: kind === 'smart' ? cfg.rules.insurance : false };
      const ts = Date.now();
      const smart = kind === 'smart' ? (cfg as SmartConfig) : null;
      set({
        ...ZERO,
        kind,
        table: newTable(rules, auto),
        you,
        ask: cfg.ask,
        indexPlays: smart?.indexPlays ?? false,
        speedMs: kind === 'bet' ? (cfg as BetConfig).speed * 1000 : null,
        spread,
        phase: 'betting',
        sweep: false,
        count: null,
        bet: null,
        ghost: false,
        note: null,
        roundNet: null,
        session: { id: newId(ts), mode: kind, ts, end: ts, n: {}, setup: `${rules.decks}D · ${n} seat${n > 1 ? 's' : ''} · ${cfg.ask === 'rc' ? 'RC' : 'TC'}${smart?.indexPlays ? ' · index plays' : ''}` },
      });
    },

    submit: (guess, bet) => {
      const { phase, table, ask, spread } = get();
      if (phase !== 'betting' || !table || !spread) return;
      const count = gradeCount(table, ask, guess, method());
      const b = gradeBet(spread, count.tc, Math.max(0, Math.round(bet)));
      set({
        phase: 'feedback',
        count,
        bet: b,
        checks: get().checks + 1,
        checksOk: get().checksOk + (count.ok ? 1 : 0),
        checksClose: get().checksClose + (count.close ? 1 : 0),
        bets: get().bets + 1,
        betsOk: get().betsOk + (b.ok ? 1 : 0),
      });
      playSound(count.ok && b.ok ? 'right' : 'wrong');
      record();
      if (count.ok && b.ok) later(1100, () => get().proceed());
    },

    proceed: () => {
      const { phase, table, you, bet, kind } = get();
      if (phase !== 'feedback' || !table || !bet) return;
      cancel();
      const n = table.seats.length;
      const mine = bet.bet;
      const ghost = mine === 0 && n === 1;
      const seats = table.seats.map((s, i) => (i === you ? { ...s, auto: kind === 'bet' || ghost } : s));
      const bets = seats.map((_, i) => (i === you ? (ghost ? 1 : mine) : 1));
      if (mine > 0) playSound('chips');
      set({ table: begin({ ...table, seats }, bets), phase: 'running', ghost, roundNet: null, note: null });
      driver.run();
    },

    act: (a) => {
      const { phase, table, indexPlays } = get();
      if (phase !== 'turn' || !table || !legal(table).includes(a)) return;
      const h = hand(table)!;
      const up = table.dealer[0]!;
      const o = options(table);
      const tc = countOf(table, method()).tc;
      const { action: right, deviation } = indexPlays ? indexAction(table.rules, h.cards, up, tc, o) : { action: bestAction(table.rules, h.cards, up, o), deviation: null };
      const c = classify(table.rules, h.cards);
      useStats.getState().addDrill({ mode: 'smart', type: c.type, row: c.row, up: upCol(up), your: a, ans: right, ...(indexPlays ? { tc } : {}) });
      const ctx = `${c.type === 'pair' ? 'pair' : c.type} ${rowLabel(c.type, c.row)} vs ${upCol(up)}${deviation ? ` (index: ${deviation.label} at TC ${tc > 0 ? '+' : ''}${tc})` : ''}`;
      grade(right, a, ctx);
      set({ table: act(table, a), phase: 'running' });
      record();
      driver.run();
    },

    insure: (take) => {
      const { phase, table, you, indexPlays } = get();
      if (phase !== 'insurance' || !table) return;
      const tc = countOf(table, method()).tc;
      const right = indexPlays && insuranceByCount(tc) ? 'Ins' : 'No';
      grade(right, take ? 'Ins' : 'No', indexPlays ? `insure at TC +3 or more (TC ${tc > 0 ? '+' : ''}${tc})` : 'basic strategy never insures');
      set({ table: insure(table, you, take), phase: 'running' });
      record();
      driver.run();
    },

    next: () => {
      const { phase, table } = get();
      if (phase !== 'result' || !table) return;
      cancel();
      set({ phase: 'sweeping', sweep: true });
      later(paceMs(usePrefs.getState().speed).sweep + 80, () => {
        const t = get().table!;
        if (pastCut(t.shoe)) {
          playSound('shuffle');
          set({ table: begin(t, []), sweep: false, phase: 'shuffle', count: null, bet: null });
          later(1500, () => set({ phase: 'betting' }));
        } else set({ table: clear(t), sweep: false, phase: 'betting', count: null, bet: null });
      });
    },

    leave: () => {
      cancel();
      driver.stop();
      if (get().checks > 0) record();
      set({ table: null, session: null, spread: null });
    },
  };
});
