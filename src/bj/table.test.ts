import { seeded, type Card } from './cards';
import { handValue } from './hand';
import { DEFAULT_RULES, type Rules } from './rules';
import { stackedShoe } from './shoe';
import { act, apply, begin, insure, legal, newTable, nextStep, runAuto, seatNet, seenRc, waitingOnHuman, type Table } from './table';

const R = (p: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...p });

/** One human seat; the shoe stacked: player, dealer up, player, dealer hole, then the draws. */
function table(top: Card[], rules = R(), seats: boolean[] = [false]): Table {
  const t = newTable(rules, seats);
  return { ...t, shoe: stackedShoe(top, rules.decks, rules.penetration) };
}

function start(top: Card[], rules = R(), bet = 10): Table {
  return runAuto(begin(table(top, rules), [bet]));
}

describe('a round', () => {
  it('deals in order and waits for the human', () => {
    const t = start(['TS', '7H', '6C', '9D']);
    expect(t.seats[0]!.hands[0]!.cards).toEqual(['TS', '6C']);
    expect(t.dealer).toEqual(['7H', '9D']);
    expect(waitingOnHuman(t)).toBe('play');
    expect(legal(t)).toEqual(['H', 'S', 'D']);
  });
  it('the hole card is not in the seen count until revealed', () => {
    const t = start(['TS', '7H', '6C', '5D']);
    // T(-1) 7(0) 6(+1) seen; hole 5 hidden.
    expect(seenRc(t)).toBe(0);
    const done = runAuto(act(t, 'S'));
    expect(done.phase).toBe('done');
    expect(seenRc(done)).toBe(done.shoe.rc);
  });
  it('stand: dealer draws to 17 and pays', () => {
    // Player 20, dealer 7+9=16 draws a 5 → 21.
    let t = start(['TS', '7H', 'KC', '9D', '5S']);
    t = runAuto(act(t, 'S'));
    expect(handValue(t.dealer)).toBe(21);
    expect(t.seats[0]!.hands[0]!.outcome).toBe('lose');
    expect(seatNet(t.seats[0]!)).toBe(-10);
  });
  it('dealer busts', () => {
    let t = start(['TS', '6H', '7C', 'TD', 'KS']);
    t = runAuto(act(t, 'S'));
    expect(t.seats[0]!.hands[0]!.outcome).toBe('win');
    expect(seatNet(t.seats[0]!)).toBe(10);
  });
  it('blackjack pays 3:2 (6:5 when set)', () => {
    let t = start(['AS', '7H', 'KC', '9D']);
    expect(t.phase).toBe('done');
    expect(seatNet(t.seats[0]!)).toBe(15);
    t = start(['AS', '7H', 'KC', '9D'], R({ bjPayout: 1.2 }));
    expect(seatNet(t.seats[0]!)).toBe(12);
  });
  it('dealer blackjack after the peek takes the bet', () => {
    const t = start(['TS', 'KH', '9C', 'AD']);
    expect(t.phase).toBe('done');
    expect(t.dealerBj).toBe(true);
    expect(seatNet(t.seats[0]!)).toBe(-10);
  });
  it('both blackjack: push', () => {
    const t = start(['AS', 'KH', 'KC', 'AD']);
    expect(t.seats[0]!.hands[0]!.outcome).toBe('push');
  });
  it('double: one card, twice the bet', () => {
    let t = start(['6S', '7H', '5C', 'TD', '9S', '8C']);
    t = act(t, 'D');
    expect(t.seats[0]!.hands[0]!.cards).toHaveLength(3);
    expect(t.seats[0]!.hands[0]!.bet).toBe(20);
    t = runAuto(t);
    // Player 20 vs dealer 17 + 8 = 25 bust.
    expect(seatNet(t.seats[0]!)).toBe(20);
  });
  it('bust ends the hand at once and the dealer does not draw', () => {
    let t = start(['TS', '6H', '6C', 'TD', 'KS', '9S']);
    t = act(t, 'H');
    expect(t.phase).toBe('dealer');
    t = runAuto(t);
    expect(t.dealer).toHaveLength(2);
    expect(t.seats[0]!.hands[0]!.outcome).toBe('bust');
  });
  it('surrender loses half', () => {
    let t = start(['TS', '9H', '6C', 'TD'], R({ surrender: true }));
    expect(legal(t)).toContain('R');
    t = runAuto(act(t, 'R'));
    expect(seatNet(t.seats[0]!)).toBe(-5);
  });
  it('split: two hands, each dealt on, played in turn', () => {
    // 8,8 vs 6; split → 8+3 (double) & 8+T stand; dealer 6+T → draws 9 bust.
    let t = start(['8S', '6H', '8C', 'TD', '3S', 'TC', '9H', '9D']);
    expect(legal(t)).toContain('P');
    t = runAuto(act(t, 'P'));
    expect(t.seats[0]!.hands.map((h) => h.cards)).toEqual([['8S', '3S'], ['8C']]);
    expect(legal(t)).toContain('D'); // DAS
    t = runAuto(act(t, 'D'));
    expect(t.seats[0]!.hands[1]!.cards).toEqual(['8C', '9H']);
    t = runAuto(act(t, 'S'));
    expect(t.phase).toBe('done');
    // hand 1: 8+3+T = 21 doubled (+20); hand 2: 17; dealer 6+T+9 = 25 bust (+10).
    expect(seatNet(t.seats[0]!)).toBe(30);
  });
  it('split aces take one card each; 21 is not a blackjack', () => {
    let t = start(['AS', '9H', 'AC', '7D', 'KS', '5C', '2D']);
    t = runAuto(act(t, 'P'));
    expect(t.phase).toBe('done');
    const [a, b] = t.seats[0]!.hands;
    expect(a!.cards).toEqual(['AS', 'KS']);
    expect(b!.cards).toEqual(['AC', '5C']);
    expect(a!.outcome).toBe('win');
    expect(a!.net).toBe(10);
    expect(b!.outcome).toBe('lose');
  });
  it('no double after split without DAS', () => {
    let t = start(['8S', '6H', '8C', 'TD', '3S'], R({ das: false }));
    t = runAuto(act(t, 'P'));
    expect(legal(t)).not.toContain('D');
  });
  it('insurance: offered on an ace, pays 2:1 when the dealer has it', () => {
    let t = start(['TS', 'AH', '9C', 'KD']);
    expect(waitingOnHuman(t)).toBe('insurance');
    t = runAuto(insure(t, 0, true));
    expect(t.dealerBj).toBe(true);
    // Hand −10, insurance +10.
    expect(seatNet(t.seats[0]!)).toBe(0);
  });
  it('insurance lost when the dealer has no blackjack, then play goes on', () => {
    let t = start(['TS', 'AH', '9C', '6D']);
    t = runAuto(insure(t, 0, true));
    expect(waitingOnHuman(t)).toBe('play');
    t = runAuto(act(t, 'S'));
    expect(t.seats[0]!.insuranceNet).toBe(-5);
  });
  it('auto seats play basic strategy around the human', () => {
    const rules = R();
    let t: Table = newTable(rules, [true, false, true], seeded(5));
    for (let round = 0; round < 200; round++) {
      t = begin(t, [10, 10, 10], seeded(round));
      for (let i = 0; i < 100; i++) {
        t = runAuto(t);
        const w = waitingOnHuman(t);
        if (!w) break;
        t = w === 'insurance' ? insure(t, 1, false) : act(t, 'S');
      }
      expect(t.phase).toBe('done');
      for (const s of t.seats) for (const h of s.hands) expect(h.outcome).toBeDefined();
    }
  });
  it('steps run one card at a time', () => {
    let t = begin(table(['TS', '7H', '6C', '9D']), [10]);
    const kinds: string[] = [];
    for (let s = nextStep(t); s; s = nextStep(t)) {
      kinds.push(s.kind);
      t = apply(t, s);
    }
    expect(kinds).toEqual(['deal', 'deal', 'deal', 'deal']);
  });
});
