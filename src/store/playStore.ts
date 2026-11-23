// Play Blackjack: your seat (with optional basic-strategy players around
// you), a bankroll that persists, insurance, splits and doubles — and a coach
// that checks each play against basic strategy and logs it to the stats.

import { create } from 'zustand';
import { upCol } from '@/bj/cards';
import { pastCut } from '@/bj/shoe';
import { act, begin, clear, hand, insure, legal, newTable, options, seatNet, seatStake, waitingOnHuman, type Table } from '@/bj/table';
import { bestAction, classify, ACTION_NAME, rowLabel, type Action } from '@/strategy/tables';
import { playSound } from '@/ui/sounds';
import { createDriver, stepDelay } from './driver';
import type { PlayConfig } from './configStore';
import { paceMs, usePrefs } from './prefsStore';
import { START_BANKROLL, newId, useStats, type Session } from './statsStore';

export type PlayStage = 'betting' | 'running' | 'insurance' | 'turn' | 'result' | 'sweeping';

export interface CoachNote {
  id: number;
  ok: boolean;
  text: string;
}

interface PlayState {
  table: Table | null;
  config: PlayConfig | null;
  /** Your seat index. */
  you: number;
  /** Money off the table. */
  bankroll: number;
  /** The bet being built (betting) or last placed. */
  bet: number;
  stage: PlayStage;
  sweep: boolean;
  coach: CoachNote | null;
  /** Your result for the round just settled. */
  roundNet: number | null;
  /** Bumped on each shuffle (for the toast). */
  shuffles: number;
  /** Other seats' fixed bets. */
  otherBets: number[];
  session: Session | null;
  start: (cfg: PlayConfig) => void;
  leave: () => void;
  addChip: (amount: number) => void;
  clearBet: () => void;
  setBet: (amount: number) => void;
  deal: () => void;
  act: (a: Action) => void;
  insure: (take: boolean) => void;
  next: () => void;
  rebuy: () => void;
}

const pace = () => paceMs(usePrefs.getState().speed);
let noteId = 0;

export const usePlay = create<PlayState>((set, get) => {
  const driver = createDriver({
    get: () => get().table!,
    set: (table) => set({ table }),
    delay: (step) => stepDelay(step, pace().card),
    after: (step) => {
      if (step.kind === 'deal' || step.kind === 'dealerHit' || step.kind === 'auto') playSound('card');
      else if (step.kind === 'reveal') playSound('flip');
    },
    idle: (t) => {
      const w = waitingOnHuman(t);
      if (w === 'play') set({ stage: 'turn' });
      else if (w === 'insurance') set({ stage: 'insurance' });
      else if (t.phase === 'done') settled(t);
    },
  });

  function settled(t: Table) {
    const { you, bankroll } = get();
    const seat = t.seats[you]!;
    const net = seatNet(seat);
    const back = seatStake(seat) + net;
    const nextBankroll = bankroll + back;
    let won = 0;
    let lost = 0;
    let pushed = 0;
    let bjs = 0;
    for (const h of seat.hands) {
      if (h.outcome === 'win' || h.outcome === 'blackjack') won++;
      else if (h.outcome === 'push') pushed++;
      else lost++;
      if (h.outcome === 'blackjack') bjs++;
    }
    const outcome = seat.hands.find((h) => h.outcome === 'blackjack') ? 'blackjack' : net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    playSound(outcome === 'blackjack' ? 'blackjack' : outcome);
    if (net > 0) setTimeout(() => playSound('chips'), 250);
    const st = useStats.getState();
    const p = st.play;
    st.setPlay({ bankroll: nextBankroll, hands: p.hands + seat.hands.length, won: p.won + won, lost: p.lost + lost, pushed: p.pushed + pushed, blackjacks: p.blackjacks + bjs, net: p.net + net });
    bumpSession({ hands: seat.hands.length, won, lost, pushed, blackjacks: bjs, net });
    set({ bankroll: nextBankroll, stage: 'result', roundNet: net });
  }

  function bumpSession(add: Record<string, number>) {
    const s = get().session;
    if (!s) return;
    const n = { ...s.n };
    for (const [k, v] of Object.entries(add)) n[k] = (n[k] ?? 0) + v;
    const next = { ...s, n, end: Date.now() };
    set({ session: next });
    useStats.getState().putSession(next);
  }

  function note(ok: boolean, text: string) {
    set({ coach: { id: ++noteId, ok, text } });
  }

  return {
    table: null,
    config: null,
    you: 0,
    bankroll: START_BANKROLL,
    bet: 0,
    stage: 'betting',
    sweep: false,
    coach: null,
    roundNet: null,
    shuffles: 0,
    otherBets: [],
    session: null,

    start: (cfg) => {
      driver.stop();
      const seats = cfg.others + 1;
      const you = Math.floor(seats / 2);
      const auto = Array.from({ length: seats }, (_, i) => i !== you);
      const bankroll = useStats.getState().play.bankroll;
      const min = cfg.rules.minBet;
      const otherBets = auto.map((a) => (a ? min * [1, 1, 2, 2, 3, 5][Math.floor(Math.random() * 6)]! : 0));
      const ts = Date.now();
      set({
        table: newTable(cfg.rules, auto),
        config: cfg,
        you,
        bankroll,
        bet: Math.min(bankroll, min * 2),
        stage: 'betting',
        sweep: false,
        coach: null,
        roundNet: null,
        otherBets,
        session: { id: newId(ts), mode: 'play', ts, end: ts, n: {}, setup: `${cfg.rules.decks}D · ${cfg.others ? `${cfg.others + 1} seats` : 'heads-up'}` },
      });
    },

    leave: () => {
      driver.stop();
      const { table, you, bankroll, stage } = get();
      // Walking away mid-hand: the stake comes back (the hand is void).
      if (table && stage !== 'result' && stage !== 'betting' && stage !== 'sweeping') {
        const refund = seatStake(table.seats[you]!);
        useStats.getState().setPlay({ bankroll: bankroll + refund });
      }
      set({ table: null, config: null, session: null });
    },

    addChip: (amount) => {
      const { stage, bet, bankroll } = get();
      if (stage !== 'betting') return;
      const next = Math.min(bankroll, bet + amount);
      if (next !== bet) playSound('chip');
      set({ bet: next });
    },
    clearBet: () => get().stage === 'betting' && set({ bet: 0 }),
    setBet: (amount) => {
      const { stage, bankroll } = get();
      if (stage !== 'betting') return;
      set({ bet: Math.max(0, Math.min(bankroll, amount)) });
    },

    deal: () => {
      const { stage, bet, bankroll, table, config, you, otherBets } = get();
      if (stage !== 'betting' || !table || !config || bet < config.rules.minBet || bet > bankroll) return;
      const bets = otherBets.map((b, i) => (i === you ? bet : b));
      playSound('chips');
      set({ table: begin(table, bets), bankroll: bankroll - bet, stage: 'running', roundNet: null, coach: null });
      driver.run();
    },

    act: (a) => {
      const { stage, table, bankroll, config } = get();
      if (stage !== 'turn' || !table || !config) return;
      if (!legal(table, bankroll).includes(a)) return;
      const h = hand(table)!;
      const o = options(table, table.turn, bankroll);
      const right = bestAction(table.rules, h.cards, table.dealer[0]!, o);
      const c = classify(table.rules, h.cards);
      useStats.getState().addDrill({ mode: 'play', type: c.type, row: c.row, up: upCol(table.dealer[0]!), your: a, ans: right });
      bumpSession({ plays: 1, playsOk: a === right ? 1 : 0 });
      if (config.coach) {
        if (a === right) set({ coach: null });
        else note(false, `Basic strategy: ${ACTION_NAME[right]} — ${c.type === 'pair' ? 'pair of' : c.type} ${rowLabel(c.type, c.row)} vs ${upCol(table.dealer[0]!)}`);
      }
      const cost = a === 'D' || a === 'P' ? h.bet : 0;
      playSound(cost ? 'chip' : 'card');
      set({ table: act(table, a), bankroll: bankroll - cost, stage: 'running' });
      driver.run();
    },

    insure: (take) => {
      const { stage, table, bankroll, you, config } = get();
      if (stage !== 'insurance' || !table || !config) return;
      const cost = take ? table.seats[you]!.hands[0]!.bet / 2 : 0;
      if (cost > bankroll) return;
      if (config.coach && take) note(false, 'Basic strategy never takes insurance (counters take it at TC +3 or more).');
      if (cost) playSound('chip');
      set({ table: insure(table, you, take), bankroll: bankroll - cost, stage: 'running' });
      driver.run();
    },

    next: () => {
      const { stage, table, bet, bankroll, config } = get();
      if (stage !== 'result' || !table || !config) return;
      set({ stage: 'sweeping', sweep: true });
      setTimeout(() => {
        const t = get().table;
        if (!t || get().stage !== 'sweeping') return;
        const shuffle = pastCut(t.shoe);
        const cleared = shuffle ? begin(t, []) : clear(t);
        if (shuffle) playSound('shuffle');
        set({
          table: cleared,
          sweep: false,
          stage: 'betting',
          shuffles: get().shuffles + (shuffle ? 1 : 0),
          bet: Math.min(bankroll, Math.max(bet, config.rules.minBet)),
        });
      }, pace().sweep + 80);
    },

    rebuy: () => {
      const p = useStats.getState().play;
      useStats.getState().setPlay({ bankroll: START_BANKROLL, rebuys: p.rebuys + 1 });
      set({ bankroll: START_BANKROLL, bet: Math.min(START_BANKROLL, (get().config?.rules.minBet ?? 10) * 2) });
    },
  };
});
