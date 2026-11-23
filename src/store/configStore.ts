// Each mode's setup (rules and options), remembered between visits.

import { create } from 'zustand';
import { DEFAULT_RULES, sanitizeRules, type Rules } from '@/bj/rules';
import type { DealMode } from '@/strategy/deal';
import { DEFAULT_SETTINGS, type SpreadSettings } from '@/math/betSpread';
import { readJson, writeJson } from './storage';

export type SpreadId = '1-12' | '1-8' | '1-4' | 'flat' | 'mine';
export type CountAsk = 'tc' | 'rc';

export interface PlayConfig {
  rules: Rules;
  /** Other players at the table (they play basic strategy). */
  others: number;
  /** Flag plays that differ from basic strategy. */
  coach: boolean;
  /** Show the running and true count. */
  showCount: boolean;
}

export interface StrategyConfig {
  rules: Rules;
  mode: DealMode;
}

export interface CountingConfig {
  decks: number;
  seats: number;
  /** Seconds per card. */
  speed: number;
  /** Ask for the count every this many cards. */
  pollEvery: number;
}

export interface BetConfig {
  rules: Rules;
  /** Seats at the table including yours. */
  seats: number;
  speed: number;
  spread: SpreadId;
  ask: CountAsk;
  showDecks: boolean;
}

export interface SmartConfig {
  rules: Rules;
  spread: SpreadId;
  ask: CountAsk;
  /** Grade plays against the Illustrious 18 + Fab 4 at the true count. */
  indexPlays: boolean;
  others: number;
  showDecks: boolean;
}

export interface AnalyzerConfig {
  rules: Rules;
  settings: SpreadSettings;
}

export interface ChartsConfig {
  rules: Rules;
}

export interface Configs {
  play: PlayConfig;
  strategy: StrategyConfig;
  counting: CountingConfig;
  bet: BetConfig;
  smart: SmartConfig;
  analyzer: AnalyzerConfig;
  charts: ChartsConfig;
}

const DEFAULTS: Configs = {
  play: { rules: DEFAULT_RULES, others: 0, coach: true, showCount: false },
  strategy: { rules: DEFAULT_RULES, mode: 'random' },
  counting: { decks: 6, seats: 5, speed: 1.0, pollEvery: 10 },
  bet: { rules: DEFAULT_RULES, seats: 3, speed: 0.8, spread: '1-12', ask: 'tc', showDecks: false },
  smart: { rules: DEFAULT_RULES, spread: '1-12', ask: 'tc', indexPlays: false, others: 0, showDecks: false },
  analyzer: { rules: DEFAULT_RULES, settings: DEFAULT_SETTINGS },
  charts: { rules: DEFAULT_RULES },
};

function load(): Configs {
  const saved = readJson<Partial<Configs>>('config', {});
  const out = { ...DEFAULTS } as Configs;
  for (const k of Object.keys(DEFAULTS) as (keyof Configs)[]) {
    const merged = { ...DEFAULTS[k], ...(saved[k] ?? {}) } as Configs[typeof k];
    if ('rules' in merged) (merged as { rules: Rules }).rules = sanitizeRules((merged as { rules: Rules }).rules);
    (out as unknown as Record<string, unknown>)[k] = merged;
  }
  return out;
}

interface ConfigState extends Configs {
  update: <K extends keyof Configs>(k: K, patch: Partial<Configs[K]>) => void;
}

export const useConfig = create<ConfigState>((set, get) => ({
  ...load(),
  update: (k, patch) => {
    set({ [k]: { ...get()[k], ...patch } } as Partial<ConfigState>);
    const { update: _u, ...cfg } = get();
    void _u;
    writeJson('config', cfg);
  },
}));
