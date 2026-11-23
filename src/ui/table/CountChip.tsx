// The running count and true count of the cards seen (an assist on the Play
// table, the answer in the trainers' feedback).

import type { Table } from '@/bj/table';
import { countOf } from '@/store/countCheck';
import { usePrefs } from '@/store/prefsStore';
import { signed } from '../shared/controls';

export function CountChip({ table }: { table: Table }) {
  const method = usePrefs((s) => s.tcMethod);
  const c = countOf(table, method);
  return (
    <span className="count-chip" title={`Running count ${c.rc}, ${c.decks} decks left`}>
      RC <b>{signed(c.rc)}</b> TC <b>{signed(c.tc)}</b>
    </span>
  );
}
