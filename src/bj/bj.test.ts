import { cardValue, hiLo, oneDeck, seeded, upCol, type Card } from './cards';
import { dealerShouldHit, handTotal, isNatural, isPair } from './hand';
import { DEFAULT_RULES, rulesSummary, sanitizeRules } from './rules';
import { decksLeft, draw, intTrueCount, newShoe, pastCut, remaining, toIntTc } from './shoe';

describe('cards', () => {
  it('values and Hi-Lo tags', () => {
    expect(cardValue('AS')).toBe(11);
    expect(cardValue('KH')).toBe(10);
    expect(cardValue('TD')).toBe(10);
    expect(cardValue('7C')).toBe(7);
    expect(hiLo('2S')).toBe(1);
    expect(hiLo('6H')).toBe(1);
    expect(hiLo('7H')).toBe(0);
    expect(hiLo('9H')).toBe(0);
    expect(hiLo('TH')).toBe(-1);
    expect(hiLo('AH')).toBe(-1);
  });
  it('a deck is balanced: 52 cards, Hi-Lo sums to 0', () => {
    const d = oneDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d).size).toBe(52);
    expect(d.reduce((n, c) => n + hiLo(c), 0)).toBe(0);
  });
  it('up-card columns', () => {
    expect(upCol('QS')).toBe('10');
    expect(upCol('AS')).toBe('A');
    expect(upCol('5D')).toBe('5');
  });
});

describe('hands', () => {
  const h = (...c: Card[]) => c;
  it('totals, soft aces', () => {
    expect(handTotal(h('AS', '6H'))).toEqual({ total: 17, soft: true });
    expect(handTotal(h('AS', '6H', 'TC'))).toEqual({ total: 17, soft: false });
    expect(handTotal(h('AS', 'AH'))).toEqual({ total: 12, soft: true });
    expect(handTotal(h('AS', 'AH', 'AD', 'AC'))).toEqual({ total: 14, soft: true });
    expect(handTotal(h('KS', 'QH', '5C')).total).toBe(25);
  });
  it('naturals and pairs', () => {
    expect(isNatural(h('AS', 'KH'))).toBe(true);
    expect(isNatural(h('AS', '5H', '5C'))).toBe(false);
    expect(isPair(h('KS', 'QH'))).toBe(true);
    expect(isPair(h('8S', '8H'))).toBe(true);
    expect(isPair(h('8S', '9H'))).toBe(false);
  });
  it('the dealer hits soft 17 only under H17', () => {
    expect(dealerShouldHit(h('AS', '6H'), true)).toBe(true);
    expect(dealerShouldHit(h('AS', '6H'), false)).toBe(false);
    expect(dealerShouldHit(h('TS', '6H'), false)).toBe(true);
    expect(dealerShouldHit(h('TS', '7H'), true)).toBe(false);
  });
});

describe('shoe', () => {
  it('draws track the running count, and a full shoe nets to zero', () => {
    let s = newShoe(2, 0.75, seeded(1));
    expect(remaining(s)).toBe(104);
    let rc = 0;
    for (let i = 0; i < 104; i++) {
      const [c, n] = draw(s);
      rc += hiLo(c);
      s = n;
      expect(s.rc).toBe(rc);
    }
    expect(s.rc).toBe(0);
    expect(pastCut(s)).toBe(true);
  });
  it('the cut card sits at the penetration', () => {
    expect(newShoe(6, 0.75).cut).toBe(234);
  });
  it('decks left to the nearest half deck, at least a half', () => {
    expect(decksLeft(312)).toBe(6);
    expect(decksLeft(170)).toBe(3.5);
    expect(decksLeft(10)).toBe(0.5);
  });
  it('true count rounding methods', () => {
    expect(intTrueCount(7, 182, 'round')).toBe(2); // 7 / 3.5 = 2
    expect(intTrueCount(5, 104, 'round')).toBe(3); // 2.5 → 3 (half away from zero)
    expect(intTrueCount(-5, 104, 'round')).toBe(-3);
    expect(intTrueCount(5, 104, 'floor')).toBe(2);
    expect(intTrueCount(-5, 104, 'floor')).toBe(-3);
    expect(intTrueCount(-5, 104, 'truncate')).toBe(-2);
    expect(Object.is(toIntTc(-0.4, 'truncate'), -0)).toBe(false);
  });
});

describe('rules', () => {
  it('summary and sanitizing', () => {
    expect(rulesSummary(DEFAULT_RULES)).toBe('6D · H17 · 3:2 · DAS');
    expect(rulesSummary({ ...DEFAULT_RULES, surrender: true, h17: false, bjPayout: 1.2 })).toBe('6D · S17 · 6:5 · DAS · LS');
    expect(sanitizeRules({ decks: 3 as number }).decks).toBe(6);
  });
});
