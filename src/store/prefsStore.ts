// Per-device preferences, kept in localStorage.

import { create } from 'zustand';
import type { TcMethod } from '@/bj/shoe';
import { readJson, writeJson } from './storage';

export type Speed = 'relaxed' | 'normal' | 'fast';

export interface Prefs {
  /** Four-colour suits (♦ orange, ♣ green) rather than red / black. */
  fourColor: boolean;
  sound: boolean;
  speed: Speed;
  /** How a true count becomes a whole number (betting, the trainers). */
  tcMethod: TcMethod;
  /** Strategy trainer: deal the next hand by itself after the feedback. */
  autoAdvance: boolean;
}

const DEFAULTS: Prefs = { fourColor: false, sound: true, speed: 'normal', tcMethod: 'round', autoAdvance: true };

export const usePrefs = create<Prefs & { set: (p: Partial<Prefs>) => void }>((set, get) => ({
  ...DEFAULTS,
  ...readJson<Partial<Prefs>>('prefs', {}),
  set: (p) => {
    set(p);
    const { set: _s, ...prefs } = { ...get(), ...p };
    void _s;
    writeJson('prefs', prefs);
  },
}));

export interface Pace {
  /** Between dealt cards. */
  card: number;
  /** A card's flight from the shoe. */
  flight: number;
  /** Pause on a finished round before the cards are swept. */
  result: number;
  /** The sweep to the discard tray. */
  sweep: number;
}

export function paceMs(speed: Speed): Pace {
  switch (speed) {
    case 'relaxed':
      return { card: 560, flight: 520, result: 1300, sweep: 420 };
    case 'fast':
      return { card: 230, flight: 300, result: 600, sweep: 260 };
    default:
      return { card: 380, flight: 420, result: 900, sweep: 340 };
  }
}

export const TC_METHOD_NAME: Record<TcMethod, string> = { round: 'Round', floor: 'Floor', truncate: 'Truncate' };
