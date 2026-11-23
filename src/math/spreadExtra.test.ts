import { PRESETS, TCS } from './betSpread';
import { compact, divergingTicks, fullSpread, niceTicks, rorLevel, sameSpread, tcLabel, withBet } from './spreadView';

describe('spread view helpers', () => {
  it('nice ticks', () => {
    expect(niceTicks(24)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(0.42)).toEqual([0, 0.2, 0.4, 0.6]);
    expect(niceTicks(0)).toEqual([0]);
  });
  it('diverging ticks share a step across zero', () => {
    const t = divergingTicks(-0.3, 0.9);
    expect(t).toContain(0);
    expect(t[0]).toBeLessThan(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(0.9);
    const steps = t.slice(1).map((v, i) => +(v - t[i]!).toFixed(9));
    expect(new Set(steps).size).toBe(1);
  });
  it('compact numbers', () => {
    expect(compact(950)).toBe('950');
    expect(compact(12_900)).toBe('12.9K');
    expect(compact(62_974)).toBe('63K');
    expect(compact(1_200_000)).toBe('1.2M');
    expect(compact(Infinity)).toBe('∞');
  });
  it('risk levels', () => {
    expect(rorLevel(2).level).toBe('good');
    expect(rorLevel(10).level).toBe('warning');
    expect(rorLevel(60).level).toBe('critical');
  });
  it('editing a spread clamps and copies', () => {
    const s = fullSpread(PRESETS['1-12']!.spread);
    const t = withBet(s, 3, -2);
    expect(t[3]).toBe(0);
    expect(s[3]).toBe(4);
    expect(withBet(s, 3, 99)[3]).toBe(50);
    expect(sameSpread(s, PRESETS['1-12']!.spread)).toBe(true);
    expect(sameSpread(s, t)).toBe(false);
    expect(Object.keys(fullSpread({}))).toHaveLength(TCS.length);
  });
  it('tc labels', () => {
    expect(tcLabel(3)).toBe('+3');
    expect(tcLabel(-2)).toBe('−2');
    expect(tcLabel(0)).toBe('0');
  });
});
