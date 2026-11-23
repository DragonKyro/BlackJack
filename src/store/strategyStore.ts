// The strategy trainer: deal a spot (by mode), take your play, grade it
// against basic strategy, log it, and deal the next one — rapid fire.

import { create } from 'zustand';
import { upCol, type Card } from '@/bj/cards';
import type { Rules } from '@/bj/rules';
import { cellStats } from '@/math/analytics';
import { dealSpot, type DealMode, type Spot } from '@/strategy/deal';
import { bestAction, classify, type Action, type HandType } from '@/strategy/tables';
import { playSound } from '@/ui/sounds';
import { paceMs, usePrefs } from './prefsStore';
import { useStats } from './statsStore';

export const FEEDBACK_MS = 1500;

export type TrainerPhase = 'dealing' | 'asking' | 'feedback' | 'sweeping';

interface StrategyState {
  rules: Rules | null;
  mode: DealMode;
  spot: Spot | null;
  /** Cards of the spot on the table so far (player, up, player, hole). */
  shown: number;
  phase: TrainerPhase;
  answer: Action | null;
  chosen: Action | null;
  cell: { type: HandType; row: string } | null;
  round: number;
  total: number;
  correct: number;
  streak: number;
  best: number;
  start: (rules: Rules, mode: DealMode) => void;
  setMode: (m: DealMode) => void;
  choose: (a: Action) => void;
  next: () => void;
  leave: () => void;
}

let session = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, f: () => void) => {
  const mine = session;
  timers.push(
    setTimeout(() => {
      if (mine === session) f();
    }, ms),
  );
};
const cancel = () => {
  session++;
  for (const t of timers) clearTimeout(t);
  timers = [];
};
const pace = () => paceMs(usePrefs.getState().speed);

export const useStrategy = create<StrategyState>((set, get) => {
  function deal() {
    const { rules, mode } = get();
    if (!rules) return;
    const spot = dealSpot(mode, rules, cellStats(useStats.getState().drills));
    const cards = spot.cards as readonly Card[];
    set({
      spot,
      shown: 0,
      phase: 'dealing',
      answer: bestAction(rules, cards, spot.up),
      chosen: null,
      cell: classify(rules, cards),
      round: get().round + 1,
    });
    const gap = Math.max(110, pace().card * 0.55);
    for (let i = 1; i <= 4; i++)
      later(gap * (i - 1) + 30, () => {
        set({ shown: i });
        playSound('card');
      });
    later(gap * 3 + pace().flight * 0.7, () => set({ phase: 'asking' }));
  }

  return {
    rules: null,
    mode: 'random',
    spot: null,
    shown: 0,
    phase: 'dealing',
    answer: null,
    chosen: null,
    cell: null,
    round: 0,
    total: 0,
    correct: 0,
    streak: 0,
    best: 0,
    start: (rules, mode) => {
      cancel();
      set({ rules, mode, total: 0, correct: 0, streak: 0, best: 0, spot: null, round: 0 });
      deal();
    },
    setMode: (mode) => set({ mode }),
    choose: (a) => {
      const { phase, answer, spot, cell, rules } = get();
      if (phase !== 'asking' || !answer || !spot || !cell || !rules) return;
      const ok = a === answer;
      useStats.getState().addDrill({ mode: 'strategy', type: cell.type, row: cell.row, up: upCol(spot.up), your: a, ans: answer });
      const streak = ok ? get().streak + 1 : 0;
      set({ phase: 'feedback', chosen: a, total: get().total + 1, correct: get().correct + (ok ? 1 : 0), streak, best: Math.max(get().best, streak) });
      playSound(ok ? 'right' : 'wrong');
      if (usePrefs.getState().autoAdvance) later(ok ? FEEDBACK_MS : FEEDBACK_MS + 900, () => get().next());
    },
    next: () => {
      if (get().phase !== 'feedback') return;
      cancel();
      set({ phase: 'sweeping' });
      later(pace().sweep * 0.8, deal);
    },
    leave: () => {
      cancel();
      set({ rules: null, spot: null });
    },
  };
});
