// Bet spread analysis: how often each true count comes up, the edge there,
// and what a spread earns — EV, standard deviation, risk of ruin and N0.
//
// The true-count distribution is computed rather than tabled: after n of N
// cards are seen, the Hi-Lo running count is a sum of n draws without
// replacement from tags with mean 0 and variance 10/13, so it is close to
// normal with variance n·(10/13)·(N−n)/(N−1). Rounds are spread evenly over
// the cards dealt before the cut. Each integer running count is turned into
// an integer true count exactly as the trainers do it (half-deck estimate,
// the chosen rounding), so deck count, penetration and rounding all matter.

import type { Rules } from '@/bj/rules';
import { decksLeft, toIntTc, type TcMethod } from '@/bj/shoe';

export const TC_MIN = -7;
export const TC_MAX = 10;
export const TCS: readonly number[] = Array.from({ length: TC_MAX - TC_MIN + 1 }, (_, i) => TC_MIN + i);

/** Units bet at each true count, TC_MIN..TC_MAX (0 = sit out / wong out). */
export type Spread = Record<number, number>;

export function betFor(spread: Spread, tc: number): number {
  const k = Math.max(TC_MIN, Math.min(TC_MAX, tc));
  return spread[k] ?? 1;
}

const make = (f: (tc: number) => number): Spread => Object.fromEntries(TCS.map((tc) => [tc, f(tc)]));

export const PRESETS: Record<string, { name: string; hint: string; spread: Spread }> = {
  '1-12': { name: '1–12', hint: 'Aggressive, wong out at −3', spread: make((tc) => (tc <= -3 ? 0 : tc <= 1 ? 1 : tc === 2 ? 2 : tc === 3 ? 4 : tc === 4 ? 8 : 12)) },
  '1-8': { name: '1–8', hint: 'Conservative ramp', spread: make((tc) => (tc <= -3 ? 0 : tc <= 1 ? 1 : tc === 2 ? 2 : tc === 3 ? 4 : tc === 4 ? 6 : 8)) },
  '1-4': { name: '1–4', hint: 'Low-heat, double-deck style', spread: make((tc) => (tc <= -3 ? 0 : tc <= 1 ? 1 : tc === 2 ? 2 : tc === 3 ? 3 : 4)) },
  flat: { name: 'Flat', hint: 'One unit always', spread: make(() => 1) },
};

export function spreadName(spread: Spread): string {
  for (const p of Object.values(PRESETS)) if (TCS.every((tc) => (p.spread[tc] ?? 0) === (spread[tc] ?? 0))) return p.name;
  const bets = TCS.map((tc) => spread[tc] ?? 0).filter((b) => b > 0);
  return bets.length ? `Custom 1–${Math.max(...bets) / Math.max(1, Math.min(...bets))}` : 'Custom';
}

// ---------------------------------------------------------------- edge

/** The player's edge (%) at TC 0 for the rules (negative: house edge). Standard additive rule effects. */
export function baseEdge(r: Rules): number {
  let e = -0.4; // 6 decks, S17, 3:2, no DAS, no surrender
  const deck: Record<number, number> = { 1: 0.48, 2: 0.19, 4: 0.06, 6: 0, 8: -0.02 };
  e += deck[r.decks] ?? 0;
  if (r.h17) e -= 0.22;
  if (r.bjPayout < 1.5) e -= 1.39;
  if (r.das && r.double && r.split) e += 0.14;
  if (r.surrender) e += 0.08;
  if (!r.double) e -= 1.48;
  if (!r.split) e -= 0.57;
  return e;
}

/** Each true count point is worth about half a percent. */
export const EDGE_PER_TC = 0.5;

export function edgeAt(r: Rules, tc: number): number {
  return baseEdge(r) + tc * EDGE_PER_TC;
}

// ---------------------------------------------------------------- distribution

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

export interface TcBucket {
  tc: number;
  /** Share of rounds at this count (0–1). */
  freq: number;
  /** Mean exact true count inside the bucket. */
  mean: number;
}

const TAG_VARIANCE = 10 / 13;

export function tcDistribution(decks: number, penetration: number, method: TcMethod, samples = 160): TcBucket[] {
  const N = decks * 52;
  const cut = Math.round(N * penetration);
  const mass = new Map<number, { p: number; sum: number }>();
  for (let k = 0; k < samples; k++) {
    const n = Math.round(((k + 0.5) / samples) * cut);
    const unseen = N - n;
    const sd = Math.sqrt((n * TAG_VARIANCE * (N - n)) / (N - 1));
    const d = decksLeft(unseen);
    if (sd < 1e-9) {
      add(mass, 0, 1 / samples, 0);
      continue;
    }
    const span = Math.ceil(sd * 5.5) + 1;
    for (let rc = -span; rc <= span; rc++) {
      const p = (phi((rc + 0.5) / sd) - phi((rc - 0.5) / sd)) / samples;
      if (p < 1e-12) continue;
      const tc = toIntTc(rc / d, method);
      add(mass, Math.max(TC_MIN, Math.min(TC_MAX, tc)), p, (rc / d) * p);
    }
  }
  const total = [...mass.values()].reduce((a, b) => a + b.p, 0);
  return TCS.map((tc) => {
    const m = mass.get(tc);
    return { tc, freq: m ? m.p / total : 0, mean: m && m.p > 0 ? m.sum / m.p : tc };
  });
}

function add(m: Map<number, { p: number; sum: number }>, tc: number, p: number, sum: number) {
  const e = m.get(tc) ?? { p: 0, sum: 0 };
  e.p += p;
  e.sum += sum;
  m.set(tc, e);
}

// ---------------------------------------------------------------- analysis

export interface SpreadSettings {
  unit: number;
  bankroll: number;
  handsPerHour: number;
}

export const DEFAULT_SETTINGS: SpreadSettings = { unit: 10, bankroll: 10000, handsPerHour: 80 };
export const UNIT_OPTIONS = [5, 10, 15, 25, 50, 100] as const;
export const BANKROLL_OPTIONS = [1000, 2500, 5000, 10000, 20000, 50000, 100000] as const;
export const HPH_OPTIONS = [60, 70, 80, 100, 120] as const;

/** Standard deviation of one hand's result, per unit bet. */
export const SD_PER_UNIT = 1.15;

export interface TcRow extends TcBucket {
  bet: number;
  /** Edge (%) at the bucket's mean count. */
  edge: number;
  /** EV contribution per round (units). */
  ev: number;
}

export interface SpreadResult {
  baseEdge: number;
  rows: TcRow[];
  /** Average units out per round (sitting out counts as 0). */
  avgBet: number;
  /** Rounds you bet on (%). */
  playedPct: number;
  /** Max bet ÷ min (non-zero) bet. */
  ratio: number;
  evHandUnits: number;
  /** EV per unit wagered (%). */
  edgeOverall: number;
  evHour: number;
  sdHandUnits: number;
  sdHour: number;
  /** Risk of ruin (%) for the bankroll. */
  ror: number;
  /** Rounds until EV equals one standard deviation (N0); Infinity when EV ≤ 0. */
  n0: number;
  n0Hours: number;
  /** Bankroll for 5% / 1% risk of ruin, in money. */
  bankroll5: number;
  bankroll1: number;
}

export function analyze(r: Rules, spread: Spread, s: SpreadSettings, method: TcMethod): SpreadResult {
  const dist = tcDistribution(r.decks, r.penetration, method);
  let ev = 0;
  let second = 0;
  let avgBet = 0;
  let played = 0;
  const rows: TcRow[] = dist.map((b) => {
    const bet = betFor(spread, b.tc);
    const edge = edgeAt(r, b.mean);
    const evRound = (bet * edge) / 100;
    ev += b.freq * evRound;
    second += b.freq * (bet * SD_PER_UNIT) ** 2;
    avgBet += b.freq * bet;
    if (bet > 0) played += b.freq;
    return { ...b, bet, edge, ev: b.freq * evRound };
  });
  const variance = Math.max(0, second - ev * ev);
  const sd = Math.sqrt(variance);
  const bets = rows.map((x) => x.bet).filter((b) => b > 0);
  const ratio = bets.length ? Math.max(...bets) / Math.min(...bets) : 0;
  const units = s.bankroll / s.unit;
  const ror = ev <= 0 ? 100 : variance <= 0 ? 0 : Math.min(100, Math.exp((-2 * ev * units) / variance) * 100);
  const n0 = ev > 0 ? variance / (ev * ev) : Infinity;
  const brFor = (risk: number) => (ev > 0 ? ((-Math.log(risk) * variance) / (2 * ev)) * s.unit : Infinity);
  return {
    baseEdge: baseEdge(r),
    rows,
    avgBet,
    playedPct: played * 100,
    ratio,
    evHandUnits: ev,
    edgeOverall: avgBet > 0 ? (ev / avgBet) * 100 : 0,
    evHour: ev * s.handsPerHour * s.unit,
    sdHandUnits: sd,
    sdHour: sd * Math.sqrt(s.handsPerHour) * s.unit,
    ror,
    n0,
    n0Hours: n0 / s.handsPerHour,
    bankroll5: brFor(0.05),
    bankroll1: brFor(0.01),
  };
}
