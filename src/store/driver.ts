// Runs a table's automatic steps on a timer, one card at a time, so the UI
// can animate each. Every mode's store owns one. `stop()` (or a newer
// `run()`) cancels pending work, so nothing stale lands after you leave.

import { apply, nextStep, type Step, type Table } from '@/bj/table';

export interface DriverHooks {
  get: () => Table;
  set: (t: Table) => void;
  /** Delay before a step (ms). */
  delay: (step: Step, t: Table) => number;
  /** After a step was applied. Return false to pause the run (e.g. a counting quiz). */
  after?: (step: Step, t: Table) => boolean | void;
  /** No automatic step left: the human's turn, or the round is over. */
  idle: (t: Table) => void;
}

export function createDriver(h: DriverHooks) {
  let session = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop(): void {
    session++;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function run(): void {
    stop();
    const mine = session;
    const pump = () => {
      if (mine !== session) return;
      const t = h.get();
      const step = nextStep(t);
      if (!step) {
        timer = null;
        h.idle(t);
        return;
      }
      timer = setTimeout(() => {
        if (mine !== session) return;
        const next = apply(h.get(), step);
        h.set(next);
        const go = h.after?.(step, next);
        if (go === false) {
          timer = null;
          return;
        }
        pump();
      }, h.delay(step, t));
    };
    pump();
  }

  return { run, stop, running: () => timer !== null };
}

/** The usual pacing: a card's interval for deals, a little longer for the dealer's turn. */
export function stepDelay(step: Step, card: number): number {
  switch (step.kind) {
    case 'deal':
      return card;
    case 'reveal':
      return card * 1.3;
    case 'dealerHit':
      return card * 1.5;
    case 'auto':
      return card * 1.3;
    case 'peek':
      return card * 1.6;
    case 'insure':
      return 120;
    case 'settle':
      return card * 1.2;
  }
}
