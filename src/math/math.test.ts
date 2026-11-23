import { DEFAULT_RULES } from '@/bj/rules';
import { PRESETS, analyze, baseEdge, betFor, tcDistribution, DEFAULT_SETTINGS } from './betSpread';
import { byUpCard, heatmap, leaks, rolling, summarize, type Drill } from './analytics';

describe('bet spread', () => {
  it('base edge follows the rule effects', () => {
    expect(baseEdge({ ...DEFAULT_RULES, h17: false, das: false })).toBeCloseTo(-0.4);
    expect(baseEdge(DEFAULT_RULES)).toBeCloseTo(-0.48);
    expect(baseEdge({ ...DEFAULT_RULES, bjPayout: 1.2 })).toBeLessThan(-1.5);
  });
  it('the TC distribution is a distribution, centred on 0, wider when deeper', () => {
    const d = tcDistribution(6, 0.75, 'round');
    const sum = d.reduce((a, b) => a + b.freq, 0);
    expect(sum).toBeCloseTo(1, 6);
    const at0 = d.find((b) => b.tc === 0)!.freq;
    expect(at0).toBeGreaterThan(0.2);
    expect(at0).toBeLessThan(0.6);
    const plus = d.filter((b) => b.tc >= 2).reduce((a, b) => a + b.freq, 0);
    const plusDeep = tcDistribution(6, 0.9, 'round').filter((b) => b.tc >= 2).reduce((a, b) => a + b.freq, 0);
    expect(plusDeep).toBeGreaterThan(plus);
    // Fewer decks swing more.
    const plus1 = tcDistribution(1, 0.75, 'round').filter((b) => b.tc >= 2).reduce((a, b) => a + b.freq, 0);
    expect(plus1).toBeGreaterThan(plus);
  });
  it('flat betting loses the house edge; a spread wins', () => {
    const flat = analyze(DEFAULT_RULES, PRESETS.flat!.spread, DEFAULT_SETTINGS, 'round');
    expect(flat.evHandUnits).toBeLessThan(0);
    expect(flat.ror).toBe(100);
    const big = analyze(DEFAULT_RULES, PRESETS['1-12']!.spread, DEFAULT_SETTINGS, 'round');
    expect(big.evHour).toBeGreaterThan(0);
    expect(big.ror).toBeGreaterThan(0);
    expect(big.ror).toBeLessThan(100);
    expect(big.n0).toBeGreaterThan(1000);
    expect(big.ratio).toBe(12);
  });
  it('bets clamp outside the table', () => {
    expect(betFor(PRESETS['1-12']!.spread, 25)).toBe(12);
    expect(betFor(PRESETS['1-12']!.spread, -20)).toBe(0);
  });
});

describe('analytics', () => {
  const d = (row: string, up: Drill['up'], your: Drill['your'], ans: Drill['ans'], type: Drill['type'] = 'hard', i = 0): Drill => ({ id: `x${i}${row}${up}${your}`, ts: i, mode: 'strategy', type, row, up, your, ans });
  const log: Drill[] = [d('16', '10', 'S', 'H'), d('16', '10', 'H', 'H'), d('12', '3', 'S', 'H'), d('8', '5', 'S', 'P', 'pair'), d('A', '6', 'P', 'P', 'pair'), d('6', '6', 'P', 'P', 'pair')];
  it('summary', () => {
    const s = summarize(log);
    expect(s.total).toBe(6);
    expect(s.correct).toBe(3);
    expect(s.byType.pair).toEqual({ total: 3, correct: 2 });
    expect(s.streak).toBe(2);
  });
  it('heatmap keeps A,A and 6,6 apart', () => {
    const h = heatmap(log, 'pair');
    const ai = h.rows.indexOf('A');
    const si = h.rows.indexOf('6');
    expect(h.cells[ai]![4]!.n).toBe(1);
    expect(h.cells[si]![4]!.n).toBe(1);
    const hard = heatmap(log, 'hard');
    const r16 = hard.rows.indexOf('16');
    expect(hard.cells[r16]![8]).toMatchObject({ n: 2, wrong: 1 });
  });
  it('rolling accuracy', () => {
    const r = rolling([...log, ...log], 4);
    expect(r).toHaveLength(9);
    expect(r[0]).toBe(25);
  });
  it('by up card and leaks', () => {
    expect(byUpCard(log).find((x) => x.col === '10')).toMatchObject({ n: 2, wrong: 1, rate: 50 });
    const l = leaks(log);
    expect(l).toHaveLength(3);
    expect(l[0]!.wrong).toBe(1);
  });
});
