// Training records: the strategy decision log (drills), trainer and table
// sessions, the Play table's bankroll and your saved bet spread. Kept in
// localStorage and synced to Firestore when signed in (net/cloud.ts merges
// both ways: entries are unions by id; `play` and `spread` take the newest).

import { create } from 'zustand';
import { UP_COLS, type UpCol } from '@/bj/cards';
import type { Drill, DrillMode } from '@/math/analytics';
import type { Spread } from '@/math/betSpread';
import type { Action, HandType } from '@/strategy/tables';
import { readJson, writeJson } from './storage';

export const DRILL_CAP = 3000;
export const SESSION_CAP = 400;
export const START_BANKROLL = 1000;

export type SessionMode = 'counting' | 'bet' | 'smart' | 'play';

/** A stretch of one mode, upserted as it goes. Counters by name (see the pages for the keys). */
export interface Session {
  id: string;
  mode: SessionMode;
  ts: number;
  end: number;
  n: Record<string, number>;
  /** A short description of the setup, e.g. "6D · 5 seats · 1.0s". */
  setup?: string;
}

export interface PlayRecord {
  bankroll: number;
  hands: number;
  won: number;
  lost: number;
  pushed: number;
  blackjacks: number;
  /** Lifetime win/loss. */
  net: number;
  peak: number;
  rebuys: number;
  at: number;
}

export interface SavedSpread {
  units: Spread;
  at: number;
}

export const NEW_PLAY: PlayRecord = { bankroll: START_BANKROLL, hands: 0, won: 0, lost: 0, pushed: 0, blackjacks: 0, net: 0, peak: START_BANKROLL, rebuys: 0, at: 0 };

export type Change = { kind: 'drill'; id: string } | { kind: 'session'; id: string } | { kind: 'play' } | { kind: 'spread' } | { kind: 'cleared' };

export function newId(ts = Date.now()): string {
  return ts.toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------------------------------------------------------------- encoding (cloud)

const MODES: DrillMode[] = ['strategy', 'smart', 'play'];
const TYPES: HandType[] = ['hard', 'soft', 'pair'];
const ACTIONS = new Set<Action>(['H', 'S', 'D', 'P', 'R']);

/** "ts|mode|type|row|up|your|ans|tc" — one indexed field per drill keeps the document small. */
export function encodeDrill(d: Drill): string {
  return [d.ts, d.mode, d.type, d.row, d.up, d.your, d.ans, d.tc ?? ''].join('|');
}

export function decodeDrill(id: string, s: string): Drill | null {
  const [ts, mode, type, row, up, your, ans, tc] = s.split('|');
  if (!MODES.includes(mode as DrillMode) || !TYPES.includes(type as HandType)) return null;
  if (!UP_COLS.includes(up as UpCol) || !ACTIONS.has(your as Action) || !ACTIONS.has(ans as Action) || !row) return null;
  const d: Drill = { id, ts: Number(ts), mode: mode as DrillMode, type: type as HandType, row, up: up as UpCol, your: your as Action, ans: ans as Action };
  if (tc !== undefined && tc !== '') d.tc = Number(tc);
  return Number.isFinite(d.ts) ? d : null;
}

export function encodeSession(s: Session): string {
  const { id: _id, ...rest } = s;
  void _id;
  return JSON.stringify(rest);
}

export function decodeSession(id: string, raw: string): Session | null {
  try {
    const s = JSON.parse(raw) as Omit<Session, 'id'>;
    if (!s || typeof s.ts !== 'number' || typeof s.n !== 'object') return null;
    return { ...s, id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- merging

export interface StatsData {
  drills: Drill[];
  sessions: Record<string, Session>;
  play: PlayRecord;
  spread: SavedSpread | null;
  /** Records from before this time were cleared (on any device). */
  cleared: number;
}

export function mergeDrills(a: readonly Drill[], b: readonly Drill[], cleared: number): Drill[] {
  const m = new Map<string, Drill>();
  for (const d of a) if (d.ts >= cleared) m.set(d.id, d);
  for (const d of b) if (d.ts >= cleared) m.set(d.id, d);
  const all = [...m.values()].sort((x, y) => x.ts - y.ts || (x.id < y.id ? -1 : 1));
  return all.length > DRILL_CAP ? all.slice(all.length - DRILL_CAP) : all;
}

export function mergeSessions(a: Record<string, Session>, b: Record<string, Session>, cleared: number): Record<string, Session> {
  const out: Record<string, Session> = {};
  for (const src of [a, b])
    for (const [id, s] of Object.entries(src)) {
      if (s.ts < cleared) continue;
      const cur = out[id];
      if (!cur || s.end > cur.end) out[id] = s;
    }
  const ids = Object.keys(out);
  if (ids.length > SESSION_CAP) {
    ids.sort((x, y) => out[x]!.ts - out[y]!.ts);
    for (const id of ids.slice(0, ids.length - SESSION_CAP)) delete out[id];
  }
  return out;
}

export function mergeData(a: StatsData, b: Partial<StatsData>): StatsData {
  const cleared = Math.max(a.cleared, b.cleared ?? 0);
  const play = b.play && b.play.at > a.play.at ? b.play : a.play;
  const spread = b.spread && (!a.spread || b.spread.at > a.spread.at) ? b.spread : a.spread;
  return {
    drills: mergeDrills(a.drills, b.drills ?? [], cleared),
    sessions: mergeSessions(a.sessions, b.sessions ?? {}, cleared),
    play: play.at < cleared ? { ...NEW_PLAY, at: cleared } : play,
    spread,
    cleared,
  };
}

// ---------------------------------------------------------------- the store

function load(): StatsData {
  return {
    drills: readJson<Drill[]>('drills', []),
    sessions: readJson<Record<string, Session>>('sessions', {}),
    play: { ...NEW_PLAY, ...readJson<Partial<PlayRecord>>('play', {}) },
    spread: readJson<SavedSpread | null>('spread', null),
    cleared: readJson<number>('cleared', 0),
  };
}

function save(d: StatsData, which: (keyof StatsData)[]): void {
  for (const k of which) writeJson(k, d[k]);
}

interface StatsState extends StatsData {
  addDrill: (d: Omit<Drill, 'id' | 'ts'> & { ts?: number }) => Drill;
  putSession: (s: Session) => void;
  setPlay: (p: Partial<PlayRecord>) => void;
  setSpread: (units: Spread) => void;
  /** Wipe the training records (drills, sessions, the Play bankroll) here and, through the sync, everywhere. */
  clearAll: () => void;
  /** Fold in records from elsewhere (the cloud). */
  absorb: (other: Partial<StatsData>) => void;
  /** Called with each change, for the cloud sync. */
  onChange: ((c: Change) => void) | null;
}

export const useStats = create<StatsState>((set, get) => ({
  ...load(),
  onChange: null,
  addDrill: (input) => {
    const ts = input.ts ?? Date.now();
    const d: Drill = { ...input, ts, id: newId(ts) };
    let drills = [...get().drills, d];
    if (drills.length > DRILL_CAP) drills = drills.slice(drills.length - DRILL_CAP);
    set({ drills });
    save(get(), ['drills']);
    get().onChange?.({ kind: 'drill', id: d.id });
    return d;
  },
  putSession: (s) => {
    const sessions = { ...get().sessions, [s.id]: s };
    set({ sessions });
    save(get(), ['sessions']);
    get().onChange?.({ kind: 'session', id: s.id });
  },
  setPlay: (p) => {
    const play = { ...get().play, ...p, at: Date.now() };
    play.peak = Math.max(play.peak, play.bankroll);
    set({ play });
    save(get(), ['play']);
    get().onChange?.({ kind: 'play' });
  },
  setSpread: (units) => {
    set({ spread: { units, at: Date.now() } });
    save(get(), ['spread']);
    get().onChange?.({ kind: 'spread' });
  },
  clearAll: () => {
    const now = Date.now();
    set({ drills: [], sessions: {}, play: { ...NEW_PLAY, at: now }, cleared: now });
    save(get(), ['drills', 'sessions', 'play', 'cleared']);
    get().onChange?.({ kind: 'cleared' });
  },
  absorb: (other) => {
    const merged = mergeData(get(), other);
    set(merged);
    save(merged, ['drills', 'sessions', 'play', 'spread', 'cleared']);
  },
}));

export function sessionsOf(sessions: Record<string, Session>, mode: SessionMode): Session[] {
  return Object.values(sessions)
    .filter((s) => s.mode === mode)
    .sort((a, b) => a.ts - b.ts);
}
