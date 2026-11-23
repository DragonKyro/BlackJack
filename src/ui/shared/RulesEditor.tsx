// The table rules, as setting rows (every mode's setup, the charts, the analyzer).

import { DECK_OPTIONS, MIN_BET_OPTIONS, PENETRATION_OPTIONS, penLabel, type Rules } from '@/bj/rules';
import { Cycle, Row, Segmented, Toggle } from './controls';

export function RulesEditor({
  rules,
  onChange,
  show = { decks: true, penetration: true, minBet: false, insurance: true },
}: {
  rules: Rules;
  onChange: (r: Rules) => void;
  show?: { decks?: boolean; penetration?: boolean; minBet?: boolean; insurance?: boolean };
}) {
  const set = (p: Partial<Rules>) => onChange({ ...rules, ...p });
  return (
    <div className="rules-editor">
      {show.decks !== false && (
        <Row label="Decks">
          <Cycle label="decks" value={rules.decks} options={DECK_OPTIONS} onChange={(decks) => set({ decks })} clamp />
        </Row>
      )}
      {show.penetration !== false && (
        <Row label="Penetration" hint="How deep the cut card sits">
          <Cycle label="penetration" value={rules.penetration} options={PENETRATION_OPTIONS} onChange={(penetration) => set({ penetration })} format={penLabel} clamp />
        </Row>
      )}
      <Row label="Dealer soft 17" hint={rules.h17 ? 'Hits soft 17 (H17)' : 'Stands on all 17s (S17)'}>
        <Segmented
          label="Dealer soft 17"
          value={rules.h17}
          onChange={(h17) => set({ h17 })}
          options={[
            { value: true, label: 'H17' },
            { value: false, label: 'S17' },
          ]}
        />
      </Row>
      <Row label="Blackjack pays">
        <Segmented
          label="Blackjack pays"
          value={rules.bjPayout >= 1.5 ? 1.5 : 1.2}
          onChange={(bjPayout) => set({ bjPayout })}
          options={[
            { value: 1.5, label: '3:2' },
            { value: 1.2, label: '6:5' },
          ]}
        />
      </Row>
      <Row label="Double down" hint="On any first two cards">
        <Toggle label="Double down" on={rules.double} onChange={(double) => set({ double })} />
      </Row>
      <Row label="Split pairs" hint="Up to four hands; split aces get one card">
        <Toggle label="Split pairs" on={rules.split} onChange={(split) => set({ split })} />
      </Row>
      <Row label="Double after split">
        <Toggle label="Double after split" on={rules.das} disabled={!rules.split || !rules.double} onChange={(das) => set({ das })} />
      </Row>
      <Row label="Late surrender" hint="Give up half after the dealer checks">
        <Toggle label="Late surrender" on={rules.surrender} onChange={(surrender) => set({ surrender })} />
      </Row>
      {show.insurance !== false && (
        <Row label="Insurance" hint="Offered when the dealer shows an ace">
          <Toggle label="Insurance" on={rules.insurance} onChange={(insurance) => set({ insurance })} />
        </Row>
      )}
      {show.minBet && (
        <Row label="Table minimum">
          <Cycle label="table minimum" value={rules.minBet} options={MIN_BET_OPTIONS} onChange={(minBet) => set({ minBet })} format={(v) => `$${v}`} clamp />
        </Row>
      )}
    </div>
  );
}
