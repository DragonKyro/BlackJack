// The strategy chart over the table (T): the chart for the hand in front of
// you, with its cell lit.

import { useState } from 'react';
import { upCol, type Card } from '@/bj/cards';
import { rulesSummary, type Rules } from '@/bj/rules';
import { classify, type HandType } from '@/strategy/tables';
import { Modal, Segmented } from './controls';
import { ActionLegend, StrategyGrid } from './StrategyGrid';

export function StrategyPeek({ rules, cards, up, onClose }: { rules: Rules; cards?: readonly Card[]; up?: Card | null; onClose: () => void }) {
  const cell = cards && cards.length >= 2 && up ? classify(rules, cards) : null;
  const [type, setType] = useState<HandType>(cell?.type ?? 'hard');
  const highlight = cell && up && cell.type === type ? { row: cell.row, col: upCol(up) } : null;
  return (
    <Modal title="Basic strategy" onClose={onClose}>
      <div className="peek-head">
        <Segmented<HandType>
          label="Chart"
          value={type}
          onChange={setType}
          options={[
            { value: 'hard', label: 'Hard' },
            { value: 'soft', label: 'Soft' },
            { value: 'pair', label: 'Pairs', disabled: !rules.split },
          ]}
        />
        <span className="faint peek-rules">{rulesSummary(rules)}</span>
      </div>
      <StrategyGrid rules={rules} type={type} highlight={highlight} compact />
      <ActionLegend />
    </Modal>
  );
}
