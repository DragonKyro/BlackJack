import { UP_COLS, seeded, type Card } from '@/bj/cards';
import { DEFAULT_RULES, type Rules } from '@/bj/rules';
import { HARD_ROWS, PAIR_ROWS, SOFT_ROWS, bestAction, charts, classify, freshOptions, indexAction, type Action } from './tables';
import { cardsForCell, dealSpot, smartCells } from './deal';

const R = (p: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...p });

describe('charts', () => {
  it('every row has ten resolved actions', () => {
    const ch = charts(R());
    const ok = new Set<Action>(['H', 'S', 'D', 'P', 'R']);
    for (const t of HARD_ROWS) expect(ch.hard[t]!.every((a) => ok.has(a))).toBe(true);
    for (const t of SOFT_ROWS) expect(ch.soft[t]!).toHaveLength(10);
    for (const p of PAIR_ROWS) expect(ch.pairs[p]).toHaveLength(10);
  });
  it('no double: D → H, Ds → S', () => {
    const ch = charts(R({ double: false }));
    expect(ch.hard[11]![0]).toBe('H');
    expect(ch.soft[18]![2]).toBe('S');
  });
  it('surrender resolves Rh', () => {
    const col10 = UP_COLS.indexOf('10');
    expect(charts(R({ surrender: false })).hard[16]![col10]).toBe('H');
    expect(charts(R({ surrender: true })).hard[16]![col10]).toBe('R');
  });
  it('no split: pairs play their totals', () => {
    const ch = charts(R({ split: false }));
    expect(ch.pairs.A[0]).toBe('H'); // soft 12 always hits
    expect(ch.pairs.A[3]).toBe('H');
    expect(ch.pairs['9'][0]).toBe('S'); // hard 18
    expect(ch.pairs['8'][4]).toBe('S'); // hard 16 vs 6
  });
  it('no DAS: Ph → H', () => {
    expect(charts(R({ das: false })).pairs['6'][0]).toBe('H');
    expect(charts(R({ das: true })).pairs['6'][0]).toBe('P');
  });
  it('H17 and S17 differ where they should', () => {
    const h = charts(R({ h17: true }));
    const s = charts(R({ h17: false }));
    const A = 9;
    expect(h.hard[11]![A]).toBe('D');
    expect(s.hard[11]![A]).toBe('H');
    expect(h.soft[19]![4]).toBe('D');
    expect(s.soft[19]![4]).toBe('S');
  });
});

describe('bestAction', () => {
  it('ports the desktop lookups', () => {
    expect(bestAction(R({ surrender: true }), ['TS', '6H'], '10')).toBe('R');
    expect(bestAction(R(), ['TS', '6H'], '10')).toBe('H');
    expect(['S', 'D']).toContain(bestAction(R(), ['AS', '7H'], '2'));
    expect(bestAction(R(), ['8S', '8H'], '6')).toBe('P');
    expect(bestAction(R({ split: false }), ['8S', '8H'], '6')).toBe('S');
    expect(bestAction(R(), ['AS', 'KH'], '5')).toBe('S');
    expect(bestAction(R(), ['6S', '5H'], '6')).toBe('D');
  });
  it('face up cards all act as ten', () => {
    for (const up of ['TS', 'JS', 'QS', 'KS'] as Card[]) expect(bestAction(R(), ['TS', '6H'], up)).toBe('H');
  });
  it('resolves against what the hand can do', () => {
    // Three-card 11 can't double; three-card soft 18 vs 4 stands.
    expect(bestAction(R(), ['2S', '4H', '5C'], '6', { ...freshOptions(R()), canDouble: false })).toBe('H');
    expect(bestAction(R(), ['AS', '3H', '4C'], '4', { ...freshOptions(R()), canDouble: false })).toBe('S');
    // A pair that can't be split again plays its total.
    expect(bestAction(R(), ['8S', '8H'], '10', { ...freshOptions(R()), canSplit: false })).toBe('H');
    // 8,8 vs A under H17: surrender if allowed, else split.
    expect(bestAction(R({ surrender: true }), ['8S', '8H'], 'A')).toBe('R');
    expect(bestAction(R(), ['8S', '8H'], 'A')).toBe('P');
  });
  it('classifies hands for the stats', () => {
    expect(classify(R(), ['8S', '8H'])).toEqual({ type: 'pair', row: '8' });
    expect(classify(R(), ['KS', 'QH'])).toEqual({ type: 'pair', row: '10' });
    expect(classify(R(), ['AS', '6H'])).toEqual({ type: 'soft', row: '17' });
    expect(classify(R(), ['9S', '7H'])).toEqual({ type: 'hard', row: '16' });
    expect(classify(R({ split: false }), ['AS', 'AH'])).toEqual({ type: 'hard', row: '12' });
  });
});

describe('index plays', () => {
  const o = freshOptions(R());
  it('16 vs 10 stands at 0+, hits below', () => {
    expect(indexAction(R(), ['TS', '6H'], 'TC', 0, o).action).toBe('S');
    expect(indexAction(R(), ['TS', '6H'], 'TC', -1, o).action).toBe('H');
  });
  it('12 vs 4 hits below 0', () => {
    expect(indexAction(R(), ['TS', '2H'], '4C', -1, o).action).toBe('H');
    expect(indexAction(R(), ['TS', '2H'], '4C', 0, o).action).toBe('S');
  });
  it('splits tens vs 6 at +4', () => {
    expect(indexAction(R(), ['TS', 'KH'], '6C', 4, o).action).toBe('P');
    expect(indexAction(R(), ['TS', 'KH'], '6C', 3, o).action).toBe('S');
  });
  it('Fab 4: 15 vs 10 surrenders at 0+ (with surrender), hits below', () => {
    const r = R({ surrender: true });
    const os = freshOptions(r);
    expect(indexAction(r, ['TS', '5H'], 'TC', 0, os).action).toBe('R');
    expect(indexAction(r, ['TS', '5H'], 'TC', -1, os).action).toBe('H');
    expect(indexAction(r, ['TS', '4H'], 'TC', 3, os).action).toBe('R');
  });
  it('a deviation to double needs a double', () => {
    expect(indexAction(R(), ['5S', '5H'], 'TC', 4, o).action).toBe('D');
    expect(indexAction(R(), ['2S', '3H', '5H'], 'TC', 4, { ...o, canDouble: false, canSplit: false }).action).toBe('H');
  });
});

describe('dealing', () => {
  it('modes deal what they promise, never a natural', () => {
    const rng = seeded(7);
    for (let i = 0; i < 300; i++) {
      for (const mode of ['random', 'hard', 'soft', 'pairs'] as const) {
        const s = dealSpot(mode, R(), new Map(), rng);
        const c = classify(R(), s.cards);
        expect(s.cards[0][0] === 'A' && ['T', 'J', 'Q', 'K'].includes(s.cards[1][0])).toBe(false);
        if (mode === 'hard') expect(c.type).toBe('hard');
        if (mode === 'soft') expect(c.type).toBe('soft');
        if (mode === 'pairs') expect(c.type).toBe('pair');
      }
    }
  });
  it('cells build the cards they name', () => {
    const rng = seeded(3);
    for (const cell of smartCells(R())) {
      const cards = cardsForCell(cell.type, cell.row, rng);
      expect(classify(R(), cards)).toEqual(cell);
    }
  });
  it('smart dealing leans on missed cells', () => {
    const rng = seeded(11);
    const cells = new Map<string, { n: number; wrong: number }>();
    for (const c of smartCells(R())) for (const col of UP_COLS) cells.set(`${c.type}|${c.row}|${col}`, { n: 20, wrong: 0 });
    cells.set('soft|18|9', { n: 20, wrong: 15 });
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const s = dealSpot('smart', R(), cells, rng);
      const c = classify(R(), s.cards);
      if (c.type === 'soft' && c.row === '18' && s.up[0] === '9') hits++;
    }
    expect(hits).toBeGreaterThan(30); // ~1 cell in 330 would be ~6
  });
});
