// Table rules, threaded through everything (the engine, strategy, the math).

export interface Rules {
  decks: number;
  /** Fraction of the shoe dealt before the cut card. */
  penetration: number;
  /** Dealer hits soft 17 (H17) — otherwise stands on all 17s (S17). */
  h17: boolean;
  /** Blackjack pays 3:2 (1.5) or 6:5 (1.2). */
  bjPayout: number;
  double: boolean;
  split: boolean;
  /** Double after split. */
  das: boolean;
  /** Late surrender (after the dealer checks for blackjack). */
  surrender: boolean;
  insurance: boolean;
  minBet: number;
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  penetration: 0.75,
  h17: true,
  bjPayout: 1.5,
  double: true,
  split: true,
  das: true,
  surrender: false,
  insurance: true,
  minBet: 10,
};

/** Hands one seat may split to. Split aces get one card each and can't be resplit. */
export const MAX_HANDS = 4;

export const DECK_OPTIONS = [1, 2, 4, 6, 8] as const;
export const PENETRATION_OPTIONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9] as const;
export const MIN_BET_OPTIONS = [5, 10, 25, 50, 100] as const;

export const bjLabel = (r: Rules) => (r.bjPayout >= 1.5 ? '3:2' : '6:5');
export const d17Label = (r: Rules) => (r.h17 ? 'H17' : 'S17');
export const penLabel = (p: number) => `${Math.round(p * 100)}%`;

/** A compact summary, e.g. "6D · H17 · 3:2 · DAS · LS". */
export function rulesSummary(r: Rules): string {
  const parts = [`${r.decks}D`, d17Label(r), bjLabel(r)];
  if (!r.double) parts.push('No DD');
  if (!r.split) parts.push('No split');
  else if (r.double && r.das) parts.push('DAS');
  if (r.surrender) parts.push('LS');
  return parts.join(' · ');
}

export function sanitizeRules(x: Partial<Rules> | undefined): Rules {
  const r = { ...DEFAULT_RULES, ...(x ?? {}) };
  if (!DECK_OPTIONS.includes(r.decks as (typeof DECK_OPTIONS)[number])) r.decks = DEFAULT_RULES.decks;
  r.penetration = Math.min(0.95, Math.max(0.4, Number(r.penetration) || DEFAULT_RULES.penetration));
  r.bjPayout = r.bjPayout >= 1.5 ? 1.5 : 1.2;
  return r;
}
