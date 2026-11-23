// The counting trainer: a full table plays itself (basic strategy) at your
// speed; every N cards seen it stops and asks for the running count.

import { create } from 'zustand';
import { DEFAULT_RULES } from '@/bj/rules';
import { pastCut } from '@/bj/shoe';
import { begin, newTable, seenCount, seenRc, type Table } from '@/bj/table';
import { playSound } from '@/ui/sounds';
import type { CountingConfig } from './configStore';
import { createDriver } from './driver';
import { newId, useStats, type Session } from './statsStore';

export type CountPhase = 'running' | 'paused' | 'quiz' | 'answer' | 'between' | 'shuffle';

export interface Answer {
  guess: number;
  actual: number;
  diff: number;
}

interface CountingState {
  table: Table | null;
  cfg: CountingConfig | null;
  phase: CountPhase;
  /** Phase to return to after a pause. */
  resume: CountPhase;
  sweep: boolean;
  last: Answer | null;
  polls: number;
  exact: number;
  close: number;
  absErr: number;
  cards: number;
  session: Session | null;
  start: (cfg: CountingConfig) => void;
  answer: (guess: number) => void;
  proceed: () => void;
  togglePause: () => void;
  leave: () => void;
}

let sinceQuiz = 0;
let lastSeen = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
let gen = 0;
const later = (ms: number, f: () => void) => {
  const mine = gen;
  timers.push(setTimeout(() => mine === gen && f(), ms));
};
const cancel = () => {
  gen++;
  timers.forEach(clearTimeout);
  timers = [];
};

export const useCounting = create<CountingState>((set, get) => {
  const ms = () => (get().cfg?.speed ?? 1) * 1000;

  const driver = createDriver({
    get: () => get().table!,
    set: (table) => set({ table }),
    delay: (step) => {
      if (step.kind === 'auto' && step.action === 'S') return ms() * 0.35;
      if (step.kind === 'settle' || step.kind === 'insure' || step.kind === 'peek') return ms() * 0.4;
      return ms();
    },
    after: (step, t) => {
      const seen = seenCount(t);
      const fresh = Math.max(0, seen - lastSeen);
      lastSeen = seen;
      if (fresh > 0) {
        playSound(step.kind === 'reveal' ? 'flip' : 'card');
        sinceQuiz += fresh;
        set({ cards: get().cards + fresh });
      }
      if (sinceQuiz >= (get().cfg?.pollEvery ?? 10)) {
        sinceQuiz = 0;
        set({ phase: 'quiz' });
        return false;
      }
    },
    idle: () => {
      // Round over: a beat to look, then sweep and deal again.
      set({ phase: 'between' });
      later(Math.max(700, ms() * 1.4), () => {
        set({ sweep: true });
        later(380, () => nextRound());
      });
    },
  });

  function nextRound() {
    const t = get().table;
    const cfg = get().cfg;
    if (!t || !cfg) return;
    const shuffle = pastCut(t.shoe);
    const next = begin(t, t.seats.map(() => 10));
    lastSeen = seenCount(next);
    if (shuffle) {
      sinceQuiz = 0;
      playSound('shuffle');
      set({ table: { ...next, seats: next.seats.map((s) => ({ ...s, hands: [] })), dealer: [], phase: 'idle' }, sweep: false, phase: 'shuffle' });
      later(1700, () => {
        set({ table: next, phase: 'running' });
        driver.run();
      });
      return;
    }
    set({ table: next, sweep: false, phase: 'running' });
    driver.run();
  }

  function record() {
    const s = get().session;
    if (!s) return;
    const { polls, exact, close, absErr, cards, cfg } = get();
    const next = { ...s, end: Date.now(), n: { polls, exact, close, absErr, cards, seats: cfg!.seats, decks: cfg!.decks, speedMs: cfg!.speed * 1000 } };
    set({ session: next });
    useStats.getState().putSession(next);
  }

  return {
    table: null,
    cfg: null,
    phase: 'running',
    resume: 'running',
    sweep: false,
    last: null,
    polls: 0,
    exact: 0,
    close: 0,
    absErr: 0,
    cards: 0,
    session: null,
    start: (cfg) => {
      cancel();
      driver.stop();
      sinceQuiz = 0;
      lastSeen = 0;
      const rules = { ...DEFAULT_RULES, decks: cfg.decks, insurance: false, surrender: false };
      const t = begin(newTable(rules, Array.from({ length: cfg.seats }, () => true)), Array.from({ length: cfg.seats }, () => 10));
      const ts = Date.now();
      set({
        table: t,
        cfg,
        phase: 'running',
        sweep: false,
        last: null,
        polls: 0,
        exact: 0,
        close: 0,
        absErr: 0,
        cards: 0,
        session: { id: newId(ts), mode: 'counting', ts, end: ts, n: {}, setup: `${cfg.decks}D · ${cfg.seats} seat${cfg.seats > 1 ? 's' : ''} · ${cfg.speed.toFixed(1)} s/card · every ${cfg.pollEvery}` },
      });
      driver.run();
    },
    answer: (guess) => {
      const t = get().table;
      if (get().phase !== 'quiz' || !t) return;
      const actual = seenRc(t);
      const diff = Math.abs(guess - actual);
      set({
        phase: 'answer',
        last: { guess, actual, diff },
        polls: get().polls + 1,
        exact: get().exact + (diff === 0 ? 1 : 0),
        close: get().close + (diff <= 1 ? 1 : 0),
        absErr: get().absErr + diff,
      });
      playSound(diff === 0 ? 'right' : 'wrong');
      record();
    },
    proceed: () => {
      if (get().phase !== 'answer') return;
      set({ phase: 'running' });
      driver.run();
    },
    togglePause: () => {
      const { phase, resume } = get();
      if (phase === 'paused') {
        set({ phase: resume });
        if (resume === 'running') driver.run();
        else if (resume === 'between') {
          set({ sweep: true });
          later(380, () => nextRound());
        }
        return;
      }
      if (phase === 'running' || phase === 'between') {
        driver.stop();
        cancel();
        set({ resume: phase, phase: 'paused' });
      }
    },
    leave: () => {
      driver.stop();
      cancel();
      if (get().polls > 0) record();
      set({ table: null, cfg: null, session: null });
    },
  };
});
