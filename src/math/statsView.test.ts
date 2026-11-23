import type { Drill } from './analytics';
import { HEAT_STOPS, bandOf, cellAnswers, errorByUp, filterDrills, heatColor, niceTicks, samplePoints, sessionHeadline, sessionMetrics, totals } from './statsView';

const d = (row: string, up: Drill['up'], your: Drill['your'], ans: Drill['ans'], mode: Drill['mode'] = 'strategy', i = 0): Drill => ({ id: `x${i}${row}${up}${your}${mode}`, ts: i, mode, type: 'hard', row, up, your, ans });

describe('stats view helpers', () => {
  it('filters by mode', () => {
    const log = [d('16', '10', 'S', 'H'), d('12', '3', 'H', 'H', 'play'), d('9', '3', 'D', 'D', 'smart')];
    expect(filterDrills(log, 'all')).toHaveLength(3);
    expect(filterDrills(log, 'play')).toHaveLength(1);
  });
  it('heat colours run from the low stop to the high stop, with readable ink', () => {
    expect(heatColor(null)).toBeNull();
    expect(heatColor(0)!.bg).toBe(HEAT_STOPS[0]![1]);
    expect(heatColor(20)!.bg).toBe(HEAT_STOPS[1]![1]);
    expect(heatColor(100)!.bg).toBe(HEAT_STOPS[3]![1]);
    expect(heatColor(20)!.fg).toBe('#0b0b0b'); // yellow takes near-black
    expect(heatColor(80)!.fg).toBe('#ffffff');
  });
  it('accuracy bands', () => {
    expect(bandOf(95)).toBe('good');
    expect(bandOf(80)).toBe('warning');
    expect(bandOf(60)).toBe('critical');
  });
  it('latest answer per cell', () => {
    const m = cellAnswers([d('16', '10', 'S', 'H', 'strategy', 1), d('16', '10', 'S', 'R', 'strategy', 2)], 'hard');
    expect(m.get('16|10')).toBe('R');
  });
  it('session roll-ups and metrics', () => {
    const t = totals([
      { mode: 'counting', ts: 0, end: 1, n: { polls: 10, exact: 7, close: 9, absErr: 4, cards: 100, seats: 5 } },
      { mode: 'counting', ts: 2, end: 3, n: { polls: 10, exact: 9, close: 10, absErr: 1, cards: 100, seats: 3 } },
    ]);
    expect(t.n.polls).toBe(20);
    expect(t.n.seats).toBe(3);
    const m = sessionMetrics('counting', t.n);
    expect(m[0]).toEqual({ label: 'Exact', value: '80%' });
    expect(m[2]!.value).toBe('0.3');
    expect(sessionHeadline('counting', t.n)).toBe(80);
    const bet = sessionMetrics('bet', { checks: 4, checksOk: 3, bets: 4, betsOk: 2, rounds: 4, net: -3, askRc: 1 });
    expect(bet[0]).toEqual({ label: 'Running count', value: '75%' });
    expect(bet.at(-1)).toEqual({ label: 'Net', value: '−3u', tone: 'neg' });
    expect(sessionMetrics('play', { hands: 3, won: 2, lost: 1, pushed: 0, blackjacks: 1, net: 25 }).at(-1)!.value).toBe('+$25');
  });
  it('trend sampling and ticks', () => {
    expect(samplePoints([1, 2, 3, 4, 5], 2)).toEqual([
      { i: 0, v: 1 },
      { i: 2, v: 3 },
      { i: 4, v: 5 },
    ]);
    expect(samplePoints([1, 2, 3, 4], 3).map((p) => p.i)).toEqual([0, 3]);
    expect(niceTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(2600, 4)).toEqual([0, 1000, 2000]);
  });
  it('error rate by up card', () => {
    const e = errorByUp([d('16', '10', 'S', 'H'), d('16', '10', 'H', 'H')]);
    expect(e.find((x) => x.col === '10')).toEqual({ col: '10', n: 2, wrong: 1, rate: 50 });
    expect(e.find((x) => x.col === '2')!.rate).toBeNull();
  });
});
