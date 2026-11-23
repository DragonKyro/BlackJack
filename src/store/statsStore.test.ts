import type { Drill } from '@/math/analytics';
import { DRILL_CAP, NEW_PLAY, decodeDrill, decodeSession, encodeDrill, encodeSession, mergeData, mergeDrills, type Session, type StatsData } from './statsStore';

const drill = (id: string, ts: number, extra: Partial<Drill> = {}): Drill => ({ id, ts, mode: 'strategy', type: 'hard', row: '16', up: '10', your: 'S', ans: 'H', ...extra });
const session = (id: string, ts: number, end: number, polls = 1): Session => ({ id, mode: 'counting', ts, end, n: { polls }, setup: '6D' });
const data = (p: Partial<StatsData> = {}): StatsData => ({ drills: [], sessions: {}, play: { ...NEW_PLAY }, spread: null, cleared: 0, ...p });

describe('cloud encoding', () => {
  it('drills round-trip through the compact string', () => {
    const d = drill('a1', 1700000000000, { tc: -2, mode: 'smart', type: 'pair', row: 'A', up: 'A', your: 'P', ans: 'P' });
    expect(decodeDrill('a1', encodeDrill(d))).toEqual(d);
    const plain = drill('b', 5);
    expect(decodeDrill('b', encodeDrill(plain))).toEqual(plain);
  });
  it('bad strings are dropped', () => {
    expect(decodeDrill('x', 'nonsense')).toBeNull();
    expect(decodeDrill('x', '1|strategy|hard|16|11|S|H|')).toBeNull();
    expect(decodeSession('x', '{bad json')).toBeNull();
  });
  it('sessions round-trip', () => {
    const s = session('s1', 10, 20, 7);
    expect(decodeSession('s1', encodeSession(s))).toEqual(s);
  });
});

describe('merging', () => {
  it('drills: union by id, in time order, capped', () => {
    const m = mergeDrills([drill('a', 3), drill('b', 1)], [drill('b', 1), drill('c', 2)], 0);
    expect(m.map((d) => d.id)).toEqual(['b', 'c', 'a']);
    const many = Array.from({ length: DRILL_CAP + 5 }, (_, i) => drill(`d${i}`, i));
    const capped = mergeDrills(many, [], 0);
    expect(capped).toHaveLength(DRILL_CAP);
    expect(capped[0]!.id).toBe('d5');
  });
  it('a clear anywhere drops older records everywhere', () => {
    const local = data({ drills: [drill('old', 100), drill('new', 300)], sessions: { s: session('s', 100, 150) } });
    const remote: Partial<StatsData> = { cleared: 200, drills: [drill('r', 250)] };
    const m = mergeData(local, remote);
    expect(m.cleared).toBe(200);
    expect(m.drills.map((d) => d.id)).toEqual(['r', 'new']);
    expect(m.sessions).toEqual({});
  });
  it('sessions: the longer-running copy wins', () => {
    const m = mergeData(data({ sessions: { s: session('s', 1, 5, 2) } }), { sessions: { s: session('s', 1, 9, 6) } });
    expect(m.sessions.s!.n.polls).toBe(6);
  });
  it('play and spread: the newest wins', () => {
    const a = data({ play: { ...NEW_PLAY, bankroll: 900, at: 10 }, spread: { units: { 0: 1 }, at: 50 } });
    const m = mergeData(a, { play: { ...NEW_PLAY, bankroll: 1500, at: 20 }, spread: { units: { 0: 2 }, at: 40 } });
    expect(m.play.bankroll).toBe(1500);
    expect(m.spread!.units[0]).toBe(1);
  });
  it('a bankroll from before a clear is reset', () => {
    const m = mergeData(data({ play: { ...NEW_PLAY, bankroll: 5, at: 10 } }), { cleared: 20 });
    expect(m.play.bankroll).toBe(NEW_PLAY.bankroll);
  });
});
